import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import {Op, Sequelize} from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import file from "../models/File";
import fs from "fs";
import UserChats from "../models/UserChats";
import redisClient from "../config/redisClient";

const CHAT_CACHE_EXPIRY = 60 * 5;
const MESSAGE_CACHE_EXPIRY = 60 * 3;

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
            let chats = JSON.parse(cachedChats);

            chats = await Promise.all(chats.map(async (chat: any) => {
                if (chat.users && Array.isArray(chat.users)) {
                    chat.users = await Promise.all(
                        chat.users.map(async (user: any) => {
                            const redisUserData = await redisClient.get(`user:${user.public_key}`);
                            if (redisUserData) {
                                const updatedUser = JSON.parse(redisUserData);
                                return {
                                    ...user,
                                    online: updatedUser.online,
                                    lastOnline: updatedUser.lastOnline,
                                    avatar: updatedUser.avatar || user.avatar,
                                };
                            }
                            return user;
                        })
                    );
                }
                return chat;
            }));
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
                    attributes: ['id', 'content', 'fileId', 'createdAt', 'userId', 'isEdited', 'unread', 'isRead'],
                    include: [
                        { model: User, as: 'user', attributes: ['username', 'public_key', 'avatar', 'lastOnline', 'online'] },
                        { model: file, as: 'attachment', attributes: ['fileName', 'filePath'] },
                    ],
                },
            ],
            order: [['updatedAt', 'DESC']],
        });

        if (!chats || chats.length === 0) {
            console.log(`⚠️ У пользователя userId=${userId} нет чатов`);
            return [];
        }

        const userChats = chats.filter(chat => chat.users?.some(user => user.id === userId));

        const resultChats = await Promise.all(userChats.map(async (chat) => {
            const messageCacheKey = `chat:${chat.id}:messages`;
            let messages: Message[] = [];

            const cachedMessages = await redisClient.get(messageCacheKey);
            if (cachedMessages) {
                try {
                    const parsedMessages = JSON.parse(cachedMessages);
                    if (Array.isArray(parsedMessages)) {
                        messages = parsedMessages.map((msg: any) => new Message(msg));
                    }
                } catch (error) {
                    console.error("❌ Ошибка при разборе кэша сообщений:", error);
                }
            }

            // Если сообщений нет в кэше, загружаем из базы
            if (messages.length === 0) {
                console.log(`🔄 Загружаем сообщения из БД для чата ID=${chat.id}`);
                const dbMessages = await Message.findAll({
                    where: { chatId: chat.id },
                    attributes: ['id', 'content', 'fileId', 'createdAt', 'userId', 'isEdited', 'unread', 'isRead'],
                    include: [
                        { model: User, as: 'user', attributes: ['username', 'public_key', 'avatar', 'lastOnline', 'online'] },
                        { model: file, as: 'attachment', attributes: ['fileName', 'filePath'] },
                    ],
                    order: [['createdAt', 'ASC']], // сообщения отсортированы от старых к новым
                });

                // Расшифровка сообщений
                messages = await Promise.all(dbMessages.map(async (message) => {
                    let decryptedContent = '';
                    try {
                        decryptedContent = decryptMessage(JSON.parse(message.content));
                    } catch (error) {
                        console.error('❌ Ошибка расшифровки сообщения:', error);
                    }

                    let attachment = null;
                    if (message.fileId) {
                        attachment = await handleFileAttachment(message.fileId);
                    }

                    return new Message({
                        ...message.toJSON(),
                        content: decryptedContent,
                        attachment,
                    });
                }));

                await redisClient.setEx(messageCacheKey, 300, JSON.stringify(messages));
            }

            const updatedUsers = chat.users
                ? await Promise.all(chat.users.map(async (user: any) => {
                    const redisUserData = await redisClient.get(`user:${user.public_key}`);
                    if (redisUserData) {
                        const updatedUser = JSON.parse(redisUserData);
                        return {
                            id: user.id,
                            public_key: user.public_key,
                            avatar: user.avatar,
                            online: updatedUser.online,
                            verified: user.verified,
                            lastOnline: updatedUser.lastOnline,
                            role: (user as any).UserChats?.role || 'member',
                            username: user.username,
                        };
                    }
                    return {
                        id: user.id,
                        public_key: user.public_key,
                        avatar: user.avatar,
                        online: user.online,
                        verified: user.verified,
                        lastOnline: user.lastOnline,
                        role: (user as any).UserChats?.role || 'member',
                        username: user.username,
                    };
                }))
                : [];

            return {
                ...chat.toJSON(),
                chatName: chat.isGroup ? chat.name : updatedUsers.find((u: any) => u.id !== userId)?.username || 'Unknown',
                users: updatedUsers,
                messages,
            };
        }));

        resultChats.sort((a: any, b: any) => {
            const aLastDate = (a.messages && a.messages.length > 0)
                ? new Date(a.messages[a.messages.length - 1].createdAt ?? a.updatedAt)
                : new Date(a.updatedAt);
            const bLastDate = (b.messages && b.messages.length > 0)
                ? new Date(b.messages[b.messages.length - 1].createdAt ?? b.updatedAt)
                : new Date(b.updatedAt);
            return bLastDate.getTime() - aLastDate.getTime();
        });

        await redisClient.setEx(cacheKey, 300, JSON.stringify(resultChats));

        console.log(`📩 Успешно загружены чаты для userId=${userId}, всего: ${resultChats.length}`);
        return resultChats;

    } catch (error) {
        console.error('❌ Ошибка при получении чатов для пользователя:', error);
        throw new Error('Не удалось получить чаты для пользователя');
    }
};




const handleFileAttachment = async (fileId: number) => {
    const cacheKey = `file:${fileId}`;

    try {
        const cachedFile = await redisClient.get(cacheKey);
        if (cachedFile) {
            console.log(`💾 Файл ${fileId} найден в Redis`);
            return JSON.parse(cachedFile);
        }

        const fileRecord = await file.findOne({ where: { id: fileId } });

        if (!fileRecord) {
            console.error(`❌ Файл не найден в базе: ID ${fileId}`);
            return null;
        }

        const fileData = {
            fileName: fileRecord.fileName,
            filePath: fileRecord.filePath,
        };

        await redisClient.setEx(`file:${fileId}`, 3600, JSON.stringify(fileData));
        console.log(`💾 Файл ${fileId} сохранен в Redis`);

        return fileData;
    } catch (error) {
        console.error(`❌ Ошибка при обработке файла: ${(error as Error).message}`);
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
