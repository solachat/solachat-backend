import { Request, Response } from 'express';
import {
    createMessage,
    getMessageById,
    getMessages,
    updateMessageContent
} from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../websocket';
import { decryptMessage, encryptMessage } from "../encryption/messageEncryption";
import User from "../models/User";
import Chat from "../models/Chat";
import {createFile} from "../services/fileService";

export const broadcastToClients = (type: string, payload: object) => {
    const messagePayload = JSON.stringify({ type, ...payload });
    wss.clients.forEach((client: any) => {
        if (client.readyState === client.OPEN) {
            client.send(messagePayload);
        }
    });
};

export const sendMessageController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;
    const { content } = req.body;
    let fileId: number | null = null;
    let decryptedFilePath: string | null = null;

    try {
        res.status(202).json({ message: 'Message received, processing...' });

        setImmediate(async () => {
            console.time('Message Processing');

            console.time('DB Query: User and Chat');
            const [sender, chat] = await Promise.all([
                User.findByPk(req.user!.id, { attributes: ['id', 'username', 'avatar', 'verified'] }),
                Chat.findByPk(Number(chatId)),
            ]);
            console.timeEnd('DB Query: User and Chat');

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (files && files['file']) {
                console.time('File Encryption and Save');
                const file = files['file'][0];
                const result = await createFile(file, req.user!.id, Number(chatId), true);
                fileId = 'savedFile' in result ? result.savedFile.id : result.id;
                decryptedFilePath = 'decryptedFilePath' in result ? result.decryptedFilePath : null;
                console.timeEnd('File Encryption and Save');
            }

            console.time('DB Write: Message');
            const message = await createMessage(
                req.user!.id,
                Number(chatId),
                content || '',
                fileId,
                sender!
            );
            console.timeEnd('DB Write: Message');

            console.time('Decrypt Message');
            const decryptedMessageContent = content ? decryptMessage(JSON.parse(message.content)) : null;
            console.timeEnd('Decrypt Message');

            console.time('Broadcast Message');
            broadcastToClients('newMessage', {
                message: {
                    ...message.toJSON(),
                    content: decryptedMessageContent || null,
                    attachment: fileId ? { fileName: files['file'][0].originalname, filePath: decryptedFilePath } : null,
                    user: { id: sender!.id, username: sender!.username, avatar: sender!.avatar },
                }
            });
            console.timeEnd('Broadcast Message');

            console.timeEnd('Message Processing');
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
        const decryptedMessages = messages.map((message) => ({
            ...message.toJSON(),
            content: decryptMessage(JSON.parse(message.content))
        }));
        res.status(200).json(decryptedMessages);
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ message: 'Ошибка при получении сообщений.' });
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
        if (!message) return res.status(404).json({ message: 'Сообщение не найдено.' });

        if (message.userId !== req.user!.id) {
            return res.status(403).json({ message: 'Вы не можете редактировать это сообщение.' });
        }

        const encryptedContent = encryptMessage(content);
        await updateMessageContent(Number(messageId), { content: JSON.stringify(encryptedContent), isEdited: true });

        broadcastToClients('editMessage', {
            message: {
                id: message.id,
                content: decryptMessage(encryptedContent),
                isEdited: true,
                chatId: message.chatId,
                updatedAt: new Date().toISOString(),
            }
        });

        res.status(200).json({ message: 'Сообщение успешно обновлено.' });
    } catch (error) {
        console.error('Ошибка при редактировании сообщения:', error);
        res.status(500).json({ message: 'Ошибка при редактировании сообщения.' });
    }
};

export const deleteMessageController = async (req: UserRequest, res: Response) => {
    const { messageId } = req.params;

    try {
        const message = await getMessageById(Number(messageId));
        if (!message) return res.status(404).json({ message: 'Сообщение не найдено.' });

        if (message.userId !== req.user!.id) {
            return res.status(403).json({ message: 'Вы не можете удалить это сообщение.' });
        }

        await message.destroy();

        broadcastToClients('deleteMessage', {
            messageId: message.id,
            chatId: message.chatId,
        });

        res.status(200).json({ message: 'Сообщение успешно удалено.' });
    } catch (error) {
        console.error('Ошибка при удалении сообщения:', error);
        res.status(500).json({ message: 'Ошибка при удалении сообщения.' });
    }
};
