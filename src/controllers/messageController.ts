import { Request, Response } from 'express';
import {
    createMessage,
    getMessageById,
    getMessages,
    updateMessageContent
} from '../services/messageService';
import { UserRequest } from '../types/types';
import { wss } from '../app';
import { decryptMessage, encryptMessage } from "../encryption/messageEncryption";
import File from '../models/File';
import User from "../models/User";
import Chat from "../models/Chat";
import {decryptFile, encryptFile} from "../encryption/fileEncryption";
import {createFile} from "../services/fileService";

const broadcastToClients = (type: string, payload: object) => {
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
        const files = req.files as { [fieldname: string]: Express.Multer.File[] };

        // Отправляем предварительный ответ клиенту
        res.status(202).json({ message: 'Message received, processing...' });

        process.nextTick(async () => {
            console.time('Message Processing');
            console.time('DB Query: User and Chat');

            // Получение данных отправителя и чата
            const [sender, chat] = await Promise.all([
                User.findByPk(req.user!.id, { attributes: ['id', 'username', 'avatar'] }),
                Chat.findByPk(Number(chatId)),
            ]);

            console.timeEnd('DB Query: User and Chat');

            if (!sender || !chat) return;

            const file = files?.['file']?.[0];
            if (file) {
                console.time('File Encryption and Save');

                // Вызов функции createFile без передачи лишних аргументов
                const result = await createFile(file, req.user!.id, Number(chatId), true);

                // Проверяем, является ли результат объектом с decryptedFilePath
                if ('savedFile' in result) {
                    const { savedFile, decryptedFilePath: decryptedPath } = result;
                    fileId = savedFile.id;
                    decryptedFilePath = decryptedPath; // Сохраняем путь к расшифрованному файлу
                } else {
                    fileId = result.id; // Если это просто файл
                }

                console.timeEnd('File Encryption and Save');
            }

            // Сохраняем сообщение в базе данных
            console.time('DB Write: Message');
            const message = await createMessage(
                req.user!.id,
                Number(chatId),
                content || '',
                fileId,
                sender
            );
            console.timeEnd('DB Write: Message');

            // Расшифровываем сообщение перед отправкой (если есть контент)
            console.time('Decrypt Message');
            const decryptedMessageContent = content ? decryptMessage(JSON.parse(message.content)) : null;
            console.timeEnd('Decrypt Message');


            console.log(decryptedFilePath)
            // Отправляем сообщение клиентам
            broadcastToClients('newMessage', {
                message: {
                    ...message.toJSON(),
                    content: decryptedMessageContent || null,
                    attachment: file ? { fileName: file.filename, filePath: decryptedFilePath } : null,
                    user: { id: sender.id, username: sender.username, avatar: sender.avatar },
                }
            });

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
