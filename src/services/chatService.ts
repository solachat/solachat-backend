import Chat from '../models/Chat';
import User from '../models/User';
import Message from '../models/Message';
import { Op } from 'sequelize';
import { decryptMessage } from '../encryption/messageEncryption';
import file from "../models/File";
import fs from "fs";

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
            console.log('Чат между этими пользователями уже существует');
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
        console.error('Ошибка создания приватного чата:', error);
        throw new Error('Не удалось создать приватный чат');
    }
};

export const createGroupChat = async (userIds: number[], chatName: string) => {
    try {
        const chat = await Chat.create({ name: chatName, isGroup: true });
        const users = await User.findAll({ where: { id: userIds } });

        if (users.length !== userIds.length) {
            throw new Error('Some users were not found');
        }

        await chat.addUsers(users);
        return chat;
    } catch (error) {
        console.error('Error creating group chat:', error);
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
                    attributes: ['id', 'content', 'createdAt'],
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
        console.error('Ошибка при получении чата по ID:', error);
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
                    through: { attributes: [] },
                },
                {
                    model: Message,
                    as: 'messages',
                    attributes: ['id', 'content', 'fileId', 'createdAt', 'userId'],
                    include: [
                        { model: User, as: 'user', attributes: ['username'] },
                        { model: file, as: 'attachment', attributes: ['fileName', 'filePath'] }
                    ],
                }
            ],
            order: [['updatedAt', 'DESC']],
        });

        const userChats = chats.filter(chat =>
            chat.users && chat.users.some(user => user.id === userId)
        );

        return userChats.map(chat => ({
            ...chat.toJSON(),
            chatName: chat.isGroup
                ? chat.name
                : (chat.users && chat.users.length > 0 ? chat.users.find(u => u.id !== userId)?.realname : 'Unknown'),
            messages: chat.messages
                ? chat.messages
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                    .map((message: Message) => {
                        const decryptedContent = decryptMessage(JSON.parse(message.content));

                        // Добавляем информацию о прикреплённом файле, если он есть
                        const attachment = message.attachment ? {
                            fileName: message.attachment.fileName,
                            filePath: message.attachment.filePath
                        } : null;

                        return {
                            ...message.toJSON(),
                            content: decryptedContent,
                            attachment
                        };
                    })
                : []
        }));
    } catch (error) {
        console.error('Ошибка получения чатов для пользователя:', error);
        throw new Error('Не удалось получить чаты для пользователя');
    }
};

// Получение чата с сообщениями
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
                    attributes: ['id', 'content', 'createdAt'],
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
        console.error('Error fetching chat with messages:', error);
        throw new Error('Failed to fetch chat with messages');
    }
};

export const deleteChat = async (chatId: number) => {
    try {
        // Получаем все сообщения, связанные с чатом
        const messages = await Message.findAll({ where: { chatId } });

        // Удаляем все файлы, прикрепленные к сообщениям
        for (const message of messages) {
            if (message.fileId) {
                const fileRecord = await file.findOne({ where: { id: message.fileId } });
                if (fileRecord) {
                    // Удаляем файл с диска
                    fs.unlinkSync(fileRecord.filePath);
                    // Удаляем запись о файле из базы данных
                    await fileRecord.destroy();
                }
            }
        }

        // Удаляем все сообщения, связанные с чатом
        await Message.destroy({ where: { chatId } });

        await file.destroy({ where: { chatId } });

        // Теперь можно безопасно удалить сам чат
        await Chat.destroy({ where: { id: chatId } });
    } catch (error) {
        console.error('Ошибка при удалении чата:', error);
        throw new Error('Не удалось удалить чат');
    }
};



