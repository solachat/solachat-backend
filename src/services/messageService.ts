import Message from '../models/Message';
import Chat from '../models/Chat';
import User from '../models/User';
import File from '../models/File';
import { encrypt } from "../utils/encryptionUtils";
import path from "path";
import fs from "fs";

// Создание сообщения
export const createMessage = async (userId: number, chatId: number, content: string, filePath?: string) => {
    const chat = await Chat.findByPk(chatId);
    const user = await User.findByPk(userId);

    if (!chat || !user) throw new Error('Chat or user not found');

    let fileId = null;

    // Проверяем, есть ли filePath
    if (filePath) {
        console.log('Looking for file with path:', filePath); // Логируем путь
        const file = await File.findOne({ where: { filePath } });

        // Проверяем, найден ли файл
        if (file) {
            fileId = file.id; // Получаем id файла
            console.log('Found file with id:', fileId); // Логируем id файла
        } else {
            throw new Error('File not found in database');
        }
    }

    // Шифруем контент сообщения
    const encryptedContent = encrypt(content);

    // Создаем новое сообщение
    const message = await Message.create({
        chatId,
        userId,
        content: JSON.stringify(encryptedContent),
        filePath: filePath,
        timestamp: new Date().toISOString(),
    });

    return message;
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
                attributes: ['filename', 'filePath', 'fileType'],
            }
        ],
        order: [['createdAt', 'ASC']]
    });

    return messages;
};
