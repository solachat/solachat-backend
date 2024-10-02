import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import { Op } from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import file from "../models/File";
import fs from "fs";
import UserChats from "../models/UserChats";
import { decryptFile } from '../encryption/fileEncryption';

export const createPrivateChat = async (user1Id: number, user2Id: number) => {
    try {
        const chats = await Chat.findAll({
            where: { isGroup: false },
            include: [
                {
                    model: User,
                    as: 'users',
                    where: { id: { [Op.in]: [user1Id, user2Id] } },
                    through: { attributes: [] },
                }
            ]
        });

        const existingChat = chats.find(chat => {
            const userIds = chat.users ? chat.users.map(user => user.id) : [];
            return userIds.includes(user1Id) && userIds.includes(user2Id) && userIds.length === 2;
        });

        if (existingChat) {
            return existingChat;
        }

        const newChat = await Chat.create({ isGroup: false });
        const user1 = await User.findByPk(user1Id);
        const user2 = await User.findByPk(user2Id);

        if (!user1 || !user2) {
            throw new Error('Один или оба пользователя не найдены');
        }

        await newChat.addUsers([user1, user2]);

        return newChat;
    } catch (error) {
        throw new Error('Не удалось создать приватный чат');
    }
};

export const createGroupChat = async (userIds: number[], chatName: string, creatorId: number, avatar?: string) => {
    try {
        console.log('Creating group chat with users:', userIds, 'and name:', chatName);

        const chat = await Chat.create({ name: chatName, isGroup: true, avatar });

        const users = await User.findAll({ where: { id: userIds } });

        if (users.length !== userIds.length) {
            console.error('Некоторые пользователи не найдены:', userIds);
            throw new Error('Некоторые пользователи не найдены');
        }

        await chat.addUsers(users);

        for (const user of users) {
            const role = user.id === creatorId ? 'owner' : 'member';

            const existingUserChat = await UserChats.findOne({
                where: {
                    chatId: chat.id,
                    userId: user.id,
                },
            });

            if (!existingUserChat) {
                await UserChats.create({
                    chatId: chat.id,
                    userId: user.id,
                    role: role,
                });
            } else if (user.id === creatorId && existingUserChat.role !== 'owner') {
                existingUserChat.role = 'owner';
                await existingUserChat.save();
            }
        }

        console.log('Group chat created successfully with owner:', creatorId);
        return chat;
    } catch (error) {
        console.error('Error during group chat creation:', error);
        throw new Error('Failed to create group chat');
    }
};

export const getChatById = async (chatId: number) => {
    try {
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'realname', 'avatar', 'online'],
                    through: { attributes: [] },
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

        if (!chat) {
            throw new Error('Чат не найден');
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
        throw new Error('Не удалось получить чат с ID ' + chatId);
    }
};

export const getChatsForUser = async (userId: number) => {
    try {
        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'realname', 'avatar', 'online'],
                    through: {
                        attributes: ['role'],
                    },
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'fileId', 'createdAt', 'userId', 'isEdited'],
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

                        // Дешифрование содержимого сообщения
                        try {
                            decryptedContent = await decryptMessage(JSON.parse(message.content)) as string;
                        } catch (error) {
                            console.error('Ошибка при расшифровке сообщения:', error);
                            decryptedContent = message.content; // Если ошибка, возвращаем оригинал
                        }

                        // Проверяем вложение
                        if (message.attachment) {
                            const encryptedFilePath = message.attachment.filePath; // Путь к зашифрованному файлу
                            const metadataPath = `${encryptedFilePath}.meta`; // Путь к метаданным

                            try {
                                if (fs.existsSync(metadataPath)) {
                                    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
                                    const decryptedFilePath = `${encryptedFilePath.replace('.enc', '')}.decrypted`; // Путь для расшифровки

                                    // Дешифруем файл, если он зашифрован
                                    await decryptFile(encryptedFilePath);

                                    attachment = {
                                        fileName: metadata.originalFileName,
                                        filePath: decryptedFilePath, // Возвращаем путь к расшифрованному файлу
                                    };
                                } else {
                                    console.error('Метаданные для файла не найдены.');
                                    attachment = {
                                        fileName: message.attachment.fileName,
                                        filePath: message.attachment.filePath,
                                    };
                                }
                            } catch (error) {
                                console.error('Ошибка при обработке вложения:', error);
                                attachment = {
                                    fileName: message.attachment.fileName,
                                    filePath: message.attachment.filePath,
                                };
                            }
                        }

                        return {
                            ...message.toJSON(),
                            content: decryptedContent,
                            attachment,
                        };
                    }))
                : [];

            return {
                ...chat.toJSON(),
                chatName: chat.isGroup
                    ? chat.name
                    : chat.users && chat.users.length > 0
                        ? chat.users.find(u => u.id !== userId)?.realname || 'Unknown'
                        : 'Unknown',
                users: (chat.users || []).map(user => ({
                    id: user.id,
                    username: user.username,
                    realname: user.realname,
                    avatar: user.avatar,
                    online: user.online,
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




export const getChatWithMessages = async (chatId: number, userId: number) => {
    try {
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    as: 'users',
                    attributes: ['id', 'username', 'realname', 'avatar'],
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

export const deleteChat = async (chatId: number, userId: number, userRole: string, isGroup: boolean) => {
    try {
        if (isGroup && userRole === 'member') {
            await UserChats.destroy({
                where: {
                    userId,
                    chatId,
                },
            });
            return;
        }

        const messages = await Message.findAll({ where: { chatId } });

        for (const message of messages) {
            if (message.fileId) {
                const fileRecord = await file.findOne({ where: { id: message.fileId } });
                if (fileRecord) {
                    fs.unlinkSync(fileRecord.filePath);
                    await fileRecord.destroy();
                }
            }
        }

        await Message.destroy({ where: { chatId } });

        await file.destroy({ where: { chatId } });

        await Chat.destroy({ where: { id: chatId } });

    } catch (error) {
        throw new Error('Не удалось удалить чат');
    }
};


export const assignRole = async (chatId: number, userId: number, role: 'admin' | 'member'): Promise<void> => {
    const userChat = await UserChats.findOne({ where: { chatId, userId } });

    if (!userChat) {
        throw new Error('Пользователь не найден в чате');
    }

    userChat.role = role;
    await userChat.save();
};

export const kickUserFromChat = async (chatId: number, userIdToKick: number, userId: number): Promise<void> => {
    const chat = await Chat.findByPk(chatId);

    if (!chat) {
        throw new Error('Чат не найден');
    }

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('У вас нет прав для удаления участников из этого чата');
    }

    const userToKick = await User.findByPk(userIdToKick);
    if (!userToKick) {
        throw new Error('Пользователь не найден');
    }

    await UserChats.destroy({
        where: { userId: userIdToKick, chatId }
    });
};

export const getUserRoleInChat = async (userId: number, chatId: number): Promise<'owner' | 'admin' | 'member' | null> => {
    const userChat = await UserChats.findOne({
        where: { userId, chatId },
    });

    return userChat ? userChat.role : null;
};

export const addUsersToGroupChat = async (chatId: number, newUserIds: number[], userId: number): Promise<void> => {
    const chat = await Chat.findByPk(chatId);

    if (!chat) {
        throw new Error('Чат не найден');
    }

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('У вас нет прав для добавления участников в этот чат');
    }

    const users = await User.findAll({ where: { id: newUserIds } });

    if (users.length !== newUserIds.length) {
        throw new Error('Некоторые пользователи не найдены');
    }

    await chat.addUsers(users);

    for (const newUserId of newUserIds) {
        const userChat = await UserChats.findOne({ where: { chatId, userId: newUserId } });
        if (userChat) {
            userChat.role = 'member';
            await userChat.save();
        }
    }
};

export const updateChatSettings = async (
    chatId: number,
    userId: number,
    groupName?: string,
    avatar?: string
) => {
    const chat = await Chat.findByPk(chatId);
    if (!chat) {
        throw new Error('Chat not found');
    }

    const userRole = await getUserRoleInChat(userId, chatId);
    if (userRole !== 'owner' && userRole !== 'admin') {
        throw new Error('Insufficient permissions');
    }

    console.log('Current chat settings:', { name: chat.name, avatar: chat.avatar });

    if (groupName) {
        chat.name = groupName;
    }

    if (avatar) {
        chat.avatar = avatar;
    }

    await chat.save();
    return chat;
};

