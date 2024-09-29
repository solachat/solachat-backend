import { Request, Response } from 'express';
import {createMessage, getMessageById, getMessages, updateMessageContent} from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import {decryptMessage, encryptMessage} from "../encryption/messageEncryption";
import File from '../models/File';
import User from "../models/User";
import {uploadFileController} from "./fileController";

export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;
    let filePath: string | undefined;

    try {
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };
        let fileId: number | null = null;

        if (files && files['file']) {
            const file = files['file'][0];
            filePath = file.path;

            // Сохраняем файл в БД
            const savedFile = await File.create({
                fileName: file.filename,
                filePath,
                fileType: file.mimetype,
                userId: req.user!.id,
                chatId: Number(chatId),
            });

            fileId = savedFile.id;
        }

        // Сразу возвращаем клиенту ответ, что запрос получен
        res.status(202).json({ message: 'Message received, processing...' });

        // Асинхронно обрабатываем остальную часть
        process.nextTick(async () => {
            console.time('Message Creation');
            const message = await createMessage(
                req.user!.id,
                Number(chatId),
                content || '',
                req.protocol,
                req.get('host') || '',
                fileId
            );
            console.timeEnd('Message Creation');

            const sender = await User.findByPk(req.user!.id, {
                attributes: ['id', 'username', 'avatar'],
            });

            const decryptedMessageContent = content ? decryptMessage(JSON.parse(message.content)) : null;
            const payload = JSON.stringify({
                type: 'newMessage',
                message: {
                    ...message.toJSON(),
                    content: decryptedMessageContent || null,
                    attachment: filePath ? { fileName: filePath.split('/').pop(), filePath } : null,
                    user: {
                        id: sender!.id,
                        username: sender!.username,
                        avatar: sender!.avatar,
                    },
                },
            });

            // Отправляем сообщение всем клиентам через WebSocket
            wss.clients.forEach((client: any) => {
                if (client.readyState === client.OPEN) {
                    client.send(payload);
                }
            });
        });
    } catch (error) {
        console.error('Ошибка при создании сообщения:', error);
        res.status(500).json({ message: 'Ошибка при создании сообщения.' });
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

export const editMessageController = async (req: UserRequest, res: Response) => {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ message: 'Необходимо предоставить содержимое сообщения.' });
    }

    try {
        const message = await getMessageById(Number(messageId));

        if (!message) {
            return res.status(404).json({ message: 'Сообщение не найдено.' });
        }

        if (message.userId !== req.user!.id) {
            return res.status(403).json({ message: 'Вы не можете редактировать это сообщение.' });
        }

        const encryptedContent = encryptMessage(content);

        await updateMessageContent(Number(messageId), {
            content: JSON.stringify(encryptedContent),
            isEdited: true,
        });

        const decryptedMessageContent = decryptMessage(encryptedContent);

        wss.clients.forEach((client: any) => {
            if (client.readyState === client.OPEN) {
                client.send(JSON.stringify({
                    type: 'editMessage',
                    message: {
                        id: message.id,
                        content: decryptedMessageContent,
                        isEdited: true,
                        chatId: message.chatId,
                        updatedAt: new Date().toISOString(),
                    }
                }));
            }
        });

        res.status(200).json({ message: 'Сообщение успешно обновлено' });

    } catch (error) {
        console.error('Error editing message:', error);
        res.status(500).json({ message: 'Ошибка при редактировании сообщения.' });
    }
};
