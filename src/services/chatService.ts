import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import { Op } from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import file from "../models/File";
import fs from "fs";
import UserChats from "../models/UserChats";
import { decryptFile } from '../encryption/fileEncryption';

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
        if (user1Id === user2Id) {
            const favoriteChat = await Chat.findOne({
                where: { isGroup: false },
                include: [
                    {
                        model: User,
                        as: 'users',
                        where: { id: user1Id },
                        through: { attributes: [] },
                    },
                ],
            });

            if (favoriteChat) return favoriteChat;
        }

        const chats = await Chat.findAll({
            where: { isGroup: false },
            include: [{
                model: User,
                as: 'users',
                where: { id: { [Op.in]: [user1Id, user2Id] } },
                through: { attributes: [] },
            }]
        });

        const existingChat = chats.find(chat => {
            const userIds = chat.users?.map(user => user.id) || [];
            return userIds.includes(user1Id) && userIds.includes(user2Id) && userIds.length === 2;
        });

        if (existingChat) return existingChat;

        const newChat = await Chat.create({ isGroup: false, isFavorite: false });
        const users = await findUsersByIds([user1Id, user2Id]);
        await newChat.addUsers(users);

        return newChat;
    } catch (error) {
        throw new Error('Не удалось создать приватный чат');
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
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'avatar', 'online', 'verified'],
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
                            attributes: ['id', 'username', 'avatar'],
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

        return { ...chat.toJSON(), messages: decryptedMessages };
    } catch (error) {
        throw new Error('Не удалось получить чат');
    }
};

export const getChatsForUser = async (userId: number) => {
    try {
        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'avatar', 'online', 'verified'],
                    through: {
                        attributes: ['role'],
                    },
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'fileId', 'createdAt', 'userId', 'isEdited', 'unread', 'isRead'],
                    include: [
                        { model: User, as: 'user', attributes: ['username', 'avatar'] },
                        { model: file, as: 'attachment', attributes: ['fileName', 'filePath'] },

                    ],
                },
            ],
            order: [['updatedAt', 'DESC']],
        });

        if (!chats || chats.length === 0) {
            return [];
        }

        const userChats = chats.filter(chat => chat.users && chat.users.some(user => user.id === userId));

        const resultChats = await Promise.all(userChats.map(async (chat) => {
            const messages = chat.messages
                ? await Promise.all(chat.messages
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map(async (message: Message) => {
                        let decryptedContent = '';
                        let attachment = null;

                    try {
                        decryptedContent = decryptMessage(JSON.parse(message.content));
                    } catch (error) {
                        console.error('Ошибка расшифровки сообщения:', error);
                    }

                    if (message.attachment) {
                        attachment = await handleFileAttachment(message.attachment);
                    }

                    return { ...message.toJSON(), content: decryptedContent, attachment };
                }))
                : [];

            return {
                ...chat.toJSON(),
                chatName: chat.isGroup
                    ? chat.name
                    : chat.users?.find(u => u.id !== userId)?.username || 'Unknown',
                users: (chat.users || []).map(user => ({
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    online: user.online,
                    verified: user.verified,
                    role: (user as any).UserChats?.role || 'member',
                })),
                messages,
            };
        }));

        return resultChats;
    } catch (error) {
        console.error('Ошибка при получении чатов для пользователя:', error);
        throw new Error('Не удалось получить чаты для пользователя');
    }
};

const handleFileAttachment = async (attachment: any) => {
    const encryptedFilePath = attachment.filePath;
    const metadataPath = `${encryptedFilePath}.meta`;

    if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const decryptedFilePath = encryptedFilePath.replace('.enc', '');

        await decryptFile(encryptedFilePath);
        return { fileName: metadata.originalFileName, filePath: decryptedFilePath };
    }

    return { fileName: attachment.fileName, filePath: attachment.filePath };
};

export const deleteChat = async (chatId: number, userId: number, userRole: string, isGroup: boolean) => {
    try {
        if (isGroup && userRole === 'member') {
            await UserChats.destroy({ where: { userId, chatId } });
            return;
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
    try {
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'avatar', 'verified'],
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

        return {
            ...chat.toJSON(),
            messages: decryptedMessages
        };
    } catch (error) {
        throw new Error('Failed to fetch chat with messages');
    }
};
