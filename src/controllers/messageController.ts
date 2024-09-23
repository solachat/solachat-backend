import { Request, Response } from 'express';
import { createMessage, getMessages } from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import { decrypt } from "../utils/encryptionUtils";
import path from "path";
import File from '../models/File';
import { ensureDirectoryExists, getDestination } from '../config/uploadConfig';

// uploadFileController
export const uploadFileController = async (req: UserRequest, res: Response) => {
    const file = req.file;
    const chatId = req.body.chatId;  // Извлекаем chatId из тела запроса

    if (!file) {
        return res.status(400).json({ message: 'File must be provided' });
    }

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID must be provided' });
    }

    try {
        // Определяем путь к файлу на основе его расширения
        const fileExtension = path.extname(file.originalname).slice(1);
        const destinationPath = getDestination(fileExtension); // Используем getDestination
        // Убедимся, что директория существует
        ensureDirectoryExists(destinationPath);

        // Сохраняем информацию о файле в базе данных
        const uploadedFile = await File.create({
            filename: file.filename,
            fileType: fileExtension,
            filePath: `${destinationPath}/${file.filename}`,  // Путь с учетом директории
            userId: req.user!.id,
            chatId: Number(chatId),  // Передаем chatId здесь
        });

        // Возвращаем информацию о загруженном файле
        res.status(200).json({ filePath: uploadedFile.filePath });
    } catch (error) {
        const err = error as Error;
        console.error('Error uploading file:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// sendMessageController
export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content, filePath } = req.body;

    console.log('Received filePath from client:', filePath); // Логируем путь, пришедший с фронта

    if (!content && !filePath) {
        return res.status(400).json({ message: 'Message content or file path must be provided' });
    }

    try {
        // Создаем сообщение с текстом и/или файлом
        const message = await createMessage(req.user!.id, Number(chatId), content || '', filePath);

        // Отправка сообщения через WebSocket
        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                const decryptedMessageContent = content ? decrypt(JSON.parse(message.content)) : null;
                client.send(JSON.stringify({
                    type: 'newMessage',
                    message: {
                        ...message.toJSON(),
                        content: decryptedMessageContent || message.filePath,
                        filePath: message.filePath // Передаем filePath к сообщению
                    }
                }));
            }
        });

        res.status(201).json(message);
    } catch (error) {
        const err = error as Error;
        console.error('Error creating message:', err.message);
        res.status(500).json({ message: err.message });
    }
};

// Контроллер для получения сообщений
export const getMessagesController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    try {
        const messages = await getMessages(Number(chatId));

        const decryptedMessages = messages.map((message) => {
            const decryptedContent = decrypt(JSON.parse(message.content));
            return {
                ...message.toJSON(),
                content: decryptedContent
            };
        });

        res.status(200).json(decryptedMessages);
    } catch (error) {
        const err = error as Error;
        console.error('Error getting messages:', err.message);
        res.status(500).json({ message: err.message });
    }
};
