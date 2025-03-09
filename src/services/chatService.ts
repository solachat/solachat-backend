import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import {Op, Sequelize} from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import file from "../models/File";
import fs from "fs";
import UserChats from "../models/UserChats";
import redisClient from "../config/redisClient";
import Session from "../models/Session";

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

export const getChatsForUser = async (userId: number) => {
    try {
        const cacheKey = `userChats:${userId}`;
        const cachedChats = await redisClient.get(cacheKey);

        if (cachedChats) {
            console.log(`📩 Загружены чаты из кэша для userId=${userId}`);
            return JSON.parse(cachedChats);
        }

        console.log(`🔄 Чаты для userId=${userId} не найдены в кэше, загружаем из базы...`);

        // Загружаем чаты пользователя
        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: "users",
                    attributes: ["id", "username", "public_key", "avatar", "online", "verified", "lastOnline"],
                    through: { attributes: ["role"] },
                },
                {
                    model: Message,
                    as: "messages",
                    attributes: ["id", "content", "fileId", "createdAt", "userId", "isEdited", "unread", "isRead"],
                    include: [
                        { model: User, as: "user", attributes: ["username", "public_key", "avatar", "lastOnline", "online"] },
                        { model: file, as: "attachment", attributes: ["id", "fileName", "filePath"] },
                    ],
                },
                {
                    model: Session,
                    as: "session",
                    attributes: ["sessionKey"],
                },
            ],
            order: [["updatedAt", "DESC"]],
        });

        if (!chats || chats.length === 0) {
            console.log(`⚠️ У пользователя userId=${userId} нет чатов`);
            return [];
        }

        // Фильтруем только те чаты, в которых есть пользователь
        const userChats = chats.filter(chat => (chat.users ?? []).some(user => user.id === userId));

        // Обрабатываем чаты и сообщения
        const resultChats = await Promise.all(userChats.map(async (chat) => {
            const messageCacheKey = `chat:${chat.id}:messages`;
            let messages: Message[] = [];

            // Загружаем сообщения из кэша, если есть
            const cachedMessages = await redisClient.get(messageCacheKey);
            if (cachedMessages) {
                try {
                    messages = JSON.parse(cachedMessages) as Message[];
                } catch (error) {
                    console.error("❌ Ошибка при разборе кэша сообщений:", error);
                }
            }

            // Если нет сообщений в кэше, загружаем из базы
            if (messages.length === 0) {
                console.log(`🔄 Загружаем сообщения из БД для чата ID=${chat.id}`);
                const dbMessages = await Message.findAll({
                    where: { chatId: chat.id },
                    attributes: ["id", "content", "fileId", "createdAt", "userId", "isEdited", "unread", "isRead"],
                    include: [
                        { model: User, as: "user", attributes: ["username", "public_key", "avatar", "lastOnline", "online"] },
                        { model: file, as: "attachment", attributes: ["id", "fileName", "filePath"] },
                    ],
                    order: [["createdAt", "ASC"]],
                });

                messages = await Promise.all(dbMessages.map(async (message) => {
                    let attachment = message.attachment ? message.attachment.toJSON() : null;

                    // Кешируем файл при загрузке
                    if (message.fileId && !attachment) {
                        const cachedAttachment = await redisClient.get(`file:${message.fileId}`);
                        if (cachedAttachment) {
                            attachment = JSON.parse(cachedAttachment);
                        } else {
                            attachment = await handleFileAttachment(message.fileId);
                            await redisClient.setEx(`file:${message.fileId}`, 600, JSON.stringify(attachment));
                        }
                    }

                    return {
                        ...message.toJSON(),
                        content: message.content, // Передаём зашифрованное сообщение без расшифровки
                        attachment,
                    } as Message;
                }));

                // Сохраняем сообщения в кэше
                await redisClient.setEx(messageCacheKey, 300, JSON.stringify(messages));
            }

            return {
                ...chat.toJSON(),
                sessionKey: (chat as any).session ? (chat as any).session.sessionKey : null,
                chatName: chat.isGroup ? chat.name : (chat.users ?? []).find(u => u.id !== userId)?.username || "Unknown",
                users: (chat.users ?? []).map(user => ({
                    id: user.id,
                    public_key: user.public_key,
                    avatar: user.avatar,
                    online: user.online,
                    lastOnline: user.lastOnline,
                    verified: user.verified,
                    role: (user as any).UserChats?.role || "member",
                })),
                messages,
            };

        }));

        resultChats.sort((a: any, b: any) => {
            const aLastDate = a.messages.length
                ? new Date(a.messages[a.messages.length - 1].createdAt ?? a.updatedAt)
                : new Date(a.updatedAt);
            const bLastDate = b.messages.length
                ? new Date(b.messages[b.messages.length - 1].createdAt ?? b.updatedAt)
                : new Date(b.updatedAt);
            return bLastDate.getTime() - aLastDate.getTime();
        });

        // Кешируем результат
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
        const fileRecord = await file.findOne({ where: { id: fileId } });

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

        await Promise.all(messages.map(async message => {
            if (message.fileId) {
                const fileRecord = await file.findByPk(message.fileId);
                if (fileRecord) {
                    fs.unlinkSync(fileRecord.filePath);
                    await fileRecord.destroy();
                }
            }
        }));

        await Message.destroy({ where: { chatId } });
        await file.destroy({ where: { chatId } });

        await Chat.destroy({ where: { id: chatId } });

    } catch (error) {
        throw new Error('Не удалось удалить чат');
    }
}

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
