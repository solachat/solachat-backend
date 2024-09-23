import { Request, Response } from 'express';
import { createMessage, getMessages } from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import { decrypt } from "../utils/encryptionUtils";
import path from "path";
import File from '../models/File';
import { ensureDirectoryExists, getDestination } from '../config/uploadConfig';

export const uploadFileController = async (req: UserRequest, res: Response) => {
    const file = req.file;
    const chatId = req.body.chatId;

    if (!file) {
        return res.status(400).json({ message: 'File must be provided' });
    }

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID must be provided' });
    }

    try {
        const fileExtension = path.extname(file.originalname).slice(1);
        const destinationPath = getDestination(fileExtension);
        ensureDirectoryExists(destinationPath);

        // Сохраняем **относительный** путь в базу данных
        const relativeFilePath = `${destinationPath}/${file.filename}`;
        console.log(`Relative file path to save in DB: ${relativeFilePath}`);

        // Сохраняем информацию о файле в базе данных
        const uploadedFile = await File.create({
            fileName: file.filename, // Здесь используется fileName вместо filename
            fileType: fileExtension,
            filePath: relativeFilePath,  // Здесь сохраняем только относительный путь
            userId: req.user!.id,
            chatId: Number(chatId),
        });

        const fileUrl = `${req.protocol}://${req.get('host')}/${relativeFilePath}`;
        res.status(200).json({ filePath: fileUrl });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Error uploading file' });
    }
};


export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content, filePath } = req.body;

    if (!content && !filePath) {
        return res.status(400).json({ message: 'Message content or file path must be provided' });
    }

    try {
        // Передаем протокол и хост в функцию создания сообщения
        const message = await createMessage(
            req.user!.id,
            Number(chatId),
            content || '',
            req.protocol,
            req.get('host') || '',
            filePath
        );

        // Загрузим информацию о файле, если она есть
        const file = message.fileId ? await File.findByPk(message.fileId) : null;

        // Отправка сообщения через WebSocket
        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                const decryptedMessageContent = content ? decrypt(JSON.parse(message.content)) : null;
                client.send(JSON.stringify({
                    type: 'newMessage',
                    message: {
                        ...message.toJSON(),
                        content: decryptedMessageContent || null,
                        attachment: file ? {
                            fileName: file.fileName,  // Используем fileName вместо filename
                            filePath: file.filePath,
                            fileType: file.fileType,
                        } : null,
                    }
                }));
            }
        });

        res.status(201).json({
            ...message.toJSON(),
            attachment: file ? {
                fileName: file.fileName,  // Используем fileName вместо filename
                filePath: file.filePath,
                fileType: file.fileType,
            } : null,
        });
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
