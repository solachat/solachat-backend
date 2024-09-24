import { Request, Response } from 'express';
import { createMessage, getMessages } from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import { decryptMessage } from "../encryption/messageEncryption";
import File from '../models/File';

export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content, filePath } = req.body;

    if (!content && !filePath) {
        return res.status(400).json({ message: 'Необходимо предоставить содержимое сообщения или путь к файлу.' });
    }

    try {
        let file = null;

        if (filePath) {
            const relativeFilePath = filePath.replace(`${req.protocol}://${req.get('host')}/`, '');

            file = await File.findOne({
                where: {
                    filePath: relativeFilePath + '.enc'
                }
            });

            if (!file) {
                throw new Error(`Зашифрованный файл не найден в базе данных для пути: ${relativeFilePath}`);
            }
        }

        const message = await createMessage(
            req.user!.id,
            Number(chatId),
            content || '',
            req.protocol,
            req.get('host') || '',
            file ? file.filePath : undefined
        );

        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                const decryptedMessageContent = content ? decryptMessage(JSON.parse(message.content)) : null;
                client.send(JSON.stringify({
                    type: 'newMessage',
                    message: {
                        ...message.toJSON(),
                        content: decryptedMessageContent || null,
                        attachment: file ? {
                            fileName: file.fileName,
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
                fileName: file.fileName,
                filePath: file.filePath,
                fileType: file.fileType,
            } : null,
        });
    } catch (error) {
        const err = error as Error;
        console.error('Error creating message:', error);
        res.status(500).json({ message: err.message });
    }
};


export const getMessagesController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    try {
        const messages = await getMessages(Number(chatId));

        const decryptedMessages = messages.map((message) => {
            const decryptedContent = decryptMessage(JSON.parse(message.content));
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
