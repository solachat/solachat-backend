import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import {Op, Sequelize} from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import File from "../models/File";
import fs from "fs";
import UserChats from "../models/UserChats";
import redisClient from "../config/redisClient";
import MessageFiles from "../models/MessageFiles";

const CHAT_CACHE_EXPIRY = 60 * 5;
const isProduction = process.env.NODE_ENV === "production";
const BASE_URL = isProduction ? process.env.BASE_URL || "https://example.com" : "http://localhost:4000";

const findUsersByIds = async (userIds: number[]) => {
    const users = await User.findAll({ where: { id: userIds } });
    if (users.length !== userIds.length) {
        throw new Error('Некоторые пользователи не найдены');
    }
    return users;
};

const upsertUserChat = async (chatId: number, userId: number, role: 'owner' | 'member') => {
    const [userChat, created] = await UserChats.findOrCreate({
        where: { chatId, userId },
        defaults: { role }
    });

    if (!created && role === 'owner' && userChat.role !== 'owner') {
        userChat.role = 'owner';
        await userChat.save();
    }
};

export const createPrivateChat = async (user1Id: number, user2Id: number) => {
    try {
        if (!user1Id || !user2Id || user1Id === -1 || user2Id === -1) {
            throw new Error("❌ Ошибка: Некорректный userId при создании чата!");
        }

        if (user1Id === user2Id) {
            throw new Error("❌ Нельзя создать чат с самим собой!");
        }

        console.log(`🔎 Проверяем, существует ли чат между user1Id=${user1Id} и user2Id=${user2Id}`);

        const existingChat = await Chat.findOne({
            where: { isGroup: false },
            include: [
                {
                    model: UserChats,
                    as: "userChats",
                    attributes: ["chatId"],
                    where: {
                        userId: { [Op.in]: [user1Id, user2Id] },
                    },
                },
            ],
        });

        if (existingChat) {
            const chatUsers = await UserChats.findAll({
                where: { chatId: existingChat.id },
                attributes: ["userId"],
            });

            const chatUserIds = chatUsers.map(user => user.userId);

            if (chatUserIds.includes(user1Id) && chatUserIds.includes(user2Id) && chatUserIds.length === 2) {
                console.log(`✅ Найден существующий чат (ID=${existingChat.id}) между ${user1Id} и ${user2Id}`);
                return existingChat;
            }
        }

        console.log(`❌ Чат не найден, создаём новый между ${user1Id} и ${user2Id}`);

        const newChat = await Chat.create({ isGroup: false, isFavorite: false });

        await UserChats.bulkCreate([
            { chatId: newChat.id, userId: user1Id },
            { chatId: newChat.id, userId: user2Id },
        ]);

        console.log(`🆕 Новый чат создан: ID=${newChat.id}`);

        return newChat;
    } catch (error) {
        console.error("❌ Ошибка при создании приватного чата:", error);
        throw new Error("Не удалось создать приватный чат");
    }
};

export const createGroupChat = async (userIds: number[], chatName: string, creatorId: number, avatar?: string) => {
    try {
        const chat = await Chat.create({ name: chatName, isGroup: true, avatar, isFavorite: false });
        const users = await findUsersByIds(userIds);
        await chat.addUsers(users);

        await Promise.all(users.map(user => upsertUserChat(chat.id, user.id, user.id === creatorId ? 'owner' : 'member')));

        return chat;
    } catch (error) {
        throw new Error('Не удалось создать групповой чат');
    }
};

export const getChatById = async (chatId: number) => {
    try {
        const cacheKey = `chat:${chatId}`;
        const cachedChat = await redisClient.get(cacheKey);

        if (cachedChat) {
            return JSON.parse(cachedChat);
        }

        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'public_key', 'avatar', 'online', 'verified', 'online', 'lastOnline'],
                    through: { attributes: [] }
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'createdAt', 'isEdited'],
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'public_key', 'avatar', 'online', 'lastOnline'],
                        }
                    ]
                }
            ],
            order: [['messages', 'createdAt', 'ASC']],
        });

        if (!chat) throw new Error('Чат не найден');

        const decryptedMessages = chat.messages?.map((message: Message) => ({
            ...message.toJSON(),
            content: decryptMessage(JSON.parse(message.content))
        }));

        const chatData = { ...chat.toJSON(), messages: decryptedMessages };

        await redisClient.setEx(cacheKey, CHAT_CACHE_EXPIRY, JSON.stringify(chatData));

        return chatData;
    } catch (error) {
        throw new Error('Не удалось получить чат');
    }
};

const getMessageAttachments = async (messageId: number, fileIds?: number[] | null) => {
    let attachments: any[] = [];

    // 1️⃣ Загружаем файлы из message_files
    const linkedFiles = await MessageFiles.findAll({
        where: { messageId },
        include: [{ model: File, as: "file" }], // ✅ Указываем alias "file"
    });

    if (linkedFiles.length > 0) {
        attachments = linkedFiles
            .map((link) => (link.getDataValue("file") ? link.getDataValue("file").toJSON() : null)) // ✅ Исправленный доступ
            .filter((f) => f !== null);
    }

    // 2️⃣ Если есть fileIds в JSON, загружаем файлы
    if (fileIds && fileIds.length > 0) {
        const jsonFiles = await File.findAll({
            where: { id: { [Op.in]: fileIds } },
        });

        attachments = [...attachments, ...jsonFiles.map((f) => f.toJSON())];
    }

    return attachments;
};




export const getChatsForUser = async (userId: number) => {
    try {
        const cacheKey = `userChats:${userId}`;
        const cachedChats = await redisClient.get(cacheKey);

        if (cachedChats) {
            console.log(`📩 Загружены чаты из кэша для userId=${userId}`);
            return JSON.parse(cachedChats);
        }

        console.log(`🔄 Чаты для userId=${userId} не найдены в кэше, загружаем из базы...`);

        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'public_key', 'avatar', 'online', 'verified', 'lastOnline'],
                    through: { attributes: ['role'] },
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'fileIds', 'createdAt', 'userId', 'isEdited', 'unread', 'isRead'],
                    include: [
                        { model: User, as: 'user', attributes: ['username', 'public_key', 'avatar', 'lastOnline', 'online'] },
                        {
                            model: MessageFiles,
                            as: 'messageFiles',
                            include: [{ model: File, as: 'file' }],
                        },
                    ],
                },
            ],
            order: [['updatedAt', 'DESC']],
        });

        if (!chats || chats.length === 0) {
            console.log(`⚠️ У пользователя userId=${userId} нет чатов`);
            return [];
        }

        // 🔄 Загружаем сообщения с файлами
        const resultChats = await Promise.all(
            chats.map(async (chat) => {
                let messages = chat.messages ? chat.messages.map(async (message) => {
                    let decryptedContent = message.content;

                    const decryptedMessages = chat.messages?.map((message: Message) => ({
                        ...message.toJSON(),
                        content: decryptMessage(JSON.parse(message.content))
                    }));

                    const attachments = message.messageFiles
                        ? message.messageFiles.map((fileLink) => fileLink.getDataValue('file'))
                        : [];

                    return {
                        ...message.toJSON(),
                        content: decryptedMessages,
                        attachments,
                    };
                }) : [];

                return {
                    ...chat.toJSON(),
                    messages,
                };
            })
        );

        await redisClient.setEx(cacheKey, 300, JSON.stringify(resultChats));

        console.log(`📩 Успешно загружены чаты для userId=${userId}, всего: ${resultChats.length}`);
        return resultChats;
    } catch (error) {
        console.error("❌ Ошибка при получении чатов для пользователя:", error);
        throw new Error("Не удалось получить чаты для пользователя");
    }
};





const normalizeFilePath = (filePath: string): string => {
    filePath = filePath.replace(/\\/g, "/");

    if (!filePath.startsWith("http")) {
        return `${BASE_URL}${filePath.startsWith("/") ? "" : "/"}${filePath}`;
    }

    return filePath;
};

const handleFileAttachment = async (fileId: number) => {
    const cacheKey = `file:${fileId}`;

    try {
        const cachedFile = await redisClient.get(cacheKey);
        if (cachedFile) {
            const parsedFile = JSON.parse(cachedFile);
            parsedFile.filePath = normalizeFilePath(parsedFile.filePath);
            console.log(`💾 Файл ${fileId} найден в Redis:`, parsedFile);
            return parsedFile;
        }

        console.log(`🔍 Поиск файла ID=${fileId} в БД...`);
        const fileRecord = await File.findOne({ where: { id: fileId } });

        if (!fileRecord) {
            console.error(`❌ Файл не найден в БД: ID ${fileId}`);
            return null;
        }

        console.log(`✅ Файл найден в БД:`, fileRecord);

        const fileData = {
            id: fileRecord.id,
            fileName: fileRecord.fileName,
            filePath: normalizeFilePath(fileRecord.filePath),
        };

        console.log(`💾 Сохранение исправленного пути файла в Redis:`, fileData);
        await redisClient.setEx(cacheKey, 3600, JSON.stringify(fileData));

        return fileData;
    } catch (error) {
        console.error(`❌ Ошибка при обработке файла ID ${fileId}: ${(error as Error).message}`);
        return null;
    }
};



export const deleteChat = async (chatId: number, userId: number, userRole: string, isGroup: boolean) => {
    try {
        if (isGroup && userRole === 'member') {
            await UserChats.destroy({ where: { userId, chatId } });

            await redisClient.del(`userChats:${userId}`);

            return;
        }

        const chatUsers = await UserChats.findAll({ where: { chatId } });

        const userIds = chatUsers.map(userChat => userChat.userId);

        await UserChats.destroy({ where: { chatId } });

        if (userIds.length > 0) {
            await Promise.all(userIds.map(async (userId) => {
                await redisClient.del(`userChats:${userId}`);
            }));
        }

        const messages = await Message.findAll({ where: { chatId } });

        await Promise.all(messages.map(async (message) => {
            if (message.fileIds && Array.isArray(message.fileIds)) {
                // 🔥 Фикс: загружаем все файлы одним запросом
                const fileRecords = await File.findAll({
                    where: { id: { [Op.in]: message.fileIds } },
                });

                for (const fileRecord of fileRecords) {
                    try {
                        fs.unlinkSync(fileRecord.filePath);
                    } catch (err) {
                        console.error(`❌ Ошибка при удалении файла ${fileRecord.filePath}:`, err);
                    }
                    await fileRecord.destroy();
                }
            }
        }));

        await Message.destroy({ where: { chatId } });
        await File.destroy({ where: { chatId } });

        await Chat.destroy({ where: { id: chatId } });

    } catch (error) {
        console.error("❌ Ошибка при удалении чата:", error);
        throw new Error('Не удалось удалить чат');
    }
};


export const assignRole = async (chatId: number, userId: number, role: 'admin' | 'member') => {
    const userChat = await UserChats.findOne({ where: { chatId, userId } });
    if (!userChat) throw new Error('Пользователь не найден в чате');

    userChat.role = role;
    await userChat.save();
};

export const kickUserFromChat = async (chatId: number, userIdToKick: number, userId: number) => {
    const chat = await Chat.findByPk(chatId);
    if (!chat) throw new Error('Чат не найден');

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') throw new Error('У вас нет прав для удаления участников');

    await UserChats.destroy({ where: { userId: userIdToKick, chatId } });
};

export const getUserRoleInChat = async (userId: number, chatId: number): Promise<'owner' | 'admin' | 'member' | null> => {
    const userChat = await UserChats.findOne({ where: { userId, chatId } });
    return userChat?.role || null;
};

export const addUsersToGroupChat = async (chatId: number, newUserIds: number[], userId: number) => {
    const chat = await Chat.findByPk(chatId);
    if (!chat) throw new Error('Чат не найден');

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') throw new Error('У вас нет прав для добавления участников');

    const users = await findUsersByIds(newUserIds);
    await chat.addUsers(users);
    await Promise.all(users.map(user => upsertUserChat(chat.id, user.id, 'member')));
};

export const updateChatSettings = async (chatId: number, userId: number, groupName?: string, avatar?: string) => {
    const chat = await Chat.findByPk(chatId);
    if (!chat) throw new Error('Чат не найден');

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') throw new Error('Недостаточно прав');

    if (groupName) chat.name = groupName;
    if (avatar) chat.avatar = avatar;

    await chat.save();
    return chat;
};

export const getChatWithMessages = async (chatId: number, userId: number) => {
    const cacheKey = `chatWithMessages:${chatId}:${userId}`;
    const cachedChat = await redisClient.get(cacheKey);

    if (cachedChat) {
        return JSON.parse(cachedChat);
    }

    try {
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'avatar', 'verified', 'online', 'lastOnline'],
                    through: { attributes: [] },
                    where: { id: userId }
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'createdAt', 'isEdited'],
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'username', 'avatar'],
                        }
                    ]
                }
            ]
        });

        if (!chat) {
            throw new Error('Chat not found or access denied');
        }

        const decryptedMessages = chat.messages?.map((message: Message) => ({
            ...message.toJSON(),
            content: decryptMessage(JSON.parse(message.content))
        }));

        const chatData = {
            ...chat.toJSON(),
            messages: decryptedMessages
        };

        await redisClient.setEx(cacheKey, CHAT_CACHE_EXPIRY, JSON.stringify(chatData));

        return chatData;
    } catch (error) {
        throw new Error('Failed to fetch chat with messages');
    }
};

export const clearChatCache = async (chatId: number, userId: number) => {
    const cacheKey = `chatWithMessages:${chatId}:${userId}`;
    await redisClient.del(cacheKey);
};
