import Message from '../models/Message';
import Chat from '../models/Chat';
import User from '../models/User';
import File from '../models/File';
import { encryptMessage } from "../encryption/messageEncryption";
import path from "path";
import fs from "fs";

export const createMessage = async (
    userId: number,
    chatId: number,
    content: string,
    protocol: string,
    host: string,
    filePath?: string
) => {
    console.log('Starting message creation process...');
    console.log('Received parameters:', { userId, chatId, content, filePath });

    const chat = await Chat.findByPk(chatId);
    const user = await User.findByPk(userId);

    if (!chat) {
        console.error(`Chat with ID ${chatId} not found`);
        throw new Error('Chat not found');
    } else {
        console.log(`Chat found: ${chatId}`);
    }

    if (!user) {
        console.error(`User with ID ${userId} not found`);
        throw new Error('User not found');
    } else {
        console.log(`User found: ${userId}`);
    }

    let fileId = null;

    if (filePath) {
        console.log('File path provided:', filePath);

        // Удаляем протокол и хост для поиска в базе данных
        let relativeFilePath = filePath.replace(`${protocol}://${host}`, '');

        // Убираем ведущий слэш, если он есть
        if (relativeFilePath.startsWith('/')) {
            relativeFilePath = relativeFilePath.slice(1);
        }

        console.log('Relative file path for DB lookup:', relativeFilePath);

        // Поиск файла в базе данных
        const file = await File.findOne({ where: { filePath: relativeFilePath } });

        if (file) {
            fileId = file.id;
            console.log('File found in DB:', file);
            console.log('File ID:', fileId);
        } else {
            console.error('File not found in DB for path:', relativeFilePath);
            throw new Error('File not found in database');
        }
    } else {
        console.log('No file path provided, creating message without file attachment');
    }

    console.log('Encrypting message content...');
    const encryptedContent = encryptMessage(content);

    try {
        console.log('Saving message to database...');
        const message = await Message.create({
            chatId,
            userId,
            content: JSON.stringify(encryptedContent),
            fileId,  // Передаем fileId, если он есть
            timestamp: new Date().toISOString(),
        });

        console.log('Message saved successfully:', message);
        return message;
    } catch (error) {
        console.error('Error creating message in DB:', error);
        throw new Error('Failed to create message');
    }
};


export const getMessages = async (chatId: number) => {
    const messages = await Message.findAll({
        where: { chatId },
        include: [
            {
                model: User,
                attributes: ['id', 'username', 'avatar'],
            },
            {
                model: File,
                as: 'attachment',
                attributes: ['fileName', 'filePath', 'fileType'],
            }
        ],
        order: [['createdAt', 'ASC']]
    });

    return messages;
};

export const getMessageById = async (messageId: number) => {
    try {
        const message = await Message.findByPk(messageId);
        return message;
    } catch (error) {
        console.error('Error fetching message by ID:', error);
        throw new Error('Failed to fetch message');
    }
};

export const updateMessageContent = async (messageId: number, updates: { content: string; isEdited: boolean }) => {
    try {
        await Message.update(updates, { where: { id: messageId } });
    } catch (error) {
        console.error('Error updating message:', error);
        throw new Error('Failed to update message');
    }
};


