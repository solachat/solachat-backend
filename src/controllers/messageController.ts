import { Request, Response } from 'express';
import {
    createMessage, deleteMessageById,
    getMessageById,
    getMessages,
    updateMessageContent
} from '../services/messageService';
import { UserRequest } from '../types/types';
import {connectedUsers, wss} from '../websocket';
import WebSocket from 'ws';
import { decryptMessage, encryptMessage } from "../encryption/messageEncryption";
import User from "../models/User";
import Chat from "../models/Chat";
import {createFile} from "../services/fileService";
import Message from "../models/Message";
import {fileQueue} from "../services/fileQueue";
import redisClient from "../config/redisClient";
import {callCreatePrivateChatController} from "../utils/utils";
import {createPrivateChat} from "../services/chatService";
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const generateUniqueFileName = (originalName: string) => {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    return `${baseName}-${Date.now()}-${uuidv4()}${ext}`;
};

const isProduction = process.env.NODE_ENV === "production";
const BASE_URL = isProduction ? process.env.BASE_URL || "https://example.com" : "http://localhost:4000";

export const broadcastToClients = (type: string, payload: object) => {
    const messagePayload = JSON.stringify({ type, ...payload });
    wss.clients.forEach((client: any) => {
        if (client.readyState === client.OPEN) {
            client.send(messagePayload);
        }
    });
};


const broadcastToChatUsers = async (chatId: number, message: any) => {
    try {
        // Получаем участников чата
        const chat = await Chat.findByPk(chatId, {
            include: [{ model: User, as: 'users', attributes: ['public_key'] }]
        });

        if (!chat || !chat.users) {
            console.error(`❌ Ошибка: Чат ${chatId} не найден или пуст.`);
            return;
        }

        const chatUserPublicKeys = chat.users.map(user => user.public_key);

        // Проверяем, есть ли WebSocket-соединение
        if (!wss) {
            console.error(`❌ Ошибка: WebSocket сервер не инициализирован.`);
            return;
        }

        // Отправляем только участникам чата
        connectedUsers.forEach(user => {
            if (chatUserPublicKeys.includes(user.publicKey) && user.ws.readyState === WebSocket.OPEN) {
                user.ws.send(JSON.stringify(message));
            }
        });

        console.log(`📢 Сообщение отправлено участникам чата ${chatId}`);
    } catch (error) {
        console.error(`❌ Ошибка при отправке WebSocket-сообщения для чата ${chatId}:`, error);
    }
};

const normalizeFilePath = (filePath: string) => filePath.replace(/\\/g, "/");

export const sendMessageController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { content, tempId } = req.body; // content уже зашифрован на клиенте
    let fileId: number | null = null;
    let decryptedFilePath: string | null = null; // Этот параметр используется для файлов

    try {
        console.log(`📩 Получен запрос на отправку сообщения в чат ID: ${chatId}`);

        // Отправляем быстрый ответ клиенту (202 Accepted)
        console.log("Отвечаю 202!");
        res.status(202).json({
            message: "Message received, processing...",
            tempId: req.body.tempId,
            createdAt: new Date().toISOString(),
        });

        // Выполняем фоновую обработку
        void (async () => {
            console.time("Message Processing");

            console.time("DB Query: User and Chat");
            const sender = await User.findByPk(req.user!.id, {
                attributes: [
                    "id",
                    "username",
                    "public_key",
                    "avatar",
                    "verified",
                    "online",
                    "lastOnline",
                ],
            });

            let chat = await Chat.findByPk(Number(chatId));
            console.timeEnd("DB Query: User and Chat");

            if (!chat) {
                console.log(`Чат ${chatId} не найден, создаем новый...`);
                try {
                    chat = await createPrivateChat(req.user!.id, Number(chatId));
                    console.log(`✅ Новый чат создан: ${chat.id}`);

                    const user1 = await User.findByPk(req.user!.id, {
                        attributes: [
                            "id",
                            "public_key",
                            "avatar",
                            "online",
                            "lastOnline",
                            "verified",
                        ],
                    });
                    const user2 = await User.findByPk(Number(chatId), {
                        attributes: [
                            "id",
                            "public_key",
                            "avatar",
                            "online",
                            "lastOnline",
                            "verified",
                        ],
                    });

                    if (user1 && user2) {
                        const chatWithUsers = {
                            id: chat.id,
                            isGroup: chat.isGroup,
                            createdAt: chat.createdAt,
                            updatedAt: chat.updatedAt,
                            name: chat.name,
                            avatar: chat.avatar,
                            users: [
                                {
                                    id: user1.id,
                                    public_key: user1.public_key,
                                    avatar: user1.avatar,
                                    online: user1.online,
                                    lastOnline: user1.lastOnline,
                                    verified: user1.verified,
                                },
                                {
                                    id: user2.id,
                                    public_key: user2.public_key,
                                    avatar: user2.avatar,
                                    online: user2.online,
                                    lastOnline: user2.lastOnline,
                                    verified: user2.verified,
                                },
                            ],
                        };
                        console.log("📢 Отправляем уведомление о создании чата:", chatWithUsers);
                        await broadcastToChatUsers(chat.id, { type: "chatCreated", chat: chatWithUsers });
                    }
                } catch (error) {
                    console.error("Ошибка при создании чата:", error);
                    throw new Error("Не удалось создать чат перед отправкой сообщения.");
                }
            }

            // Обработка файла (если есть)
            const files = req.files as { [fieldname: string]: Express.Multer.File[] };
            if (files?.file) {
                console.time("File Queue: Adding File");
                const file = files["file"][0];
                const uniqueFileName = generateUniqueFileName(file.originalname);

                const job = await fileQueue.add({
                    file,
                    userId: req.user!.id,
                    chatId: chat.id,
                    uniqueFileName,
                });

                const result = await job.finished();
                fileId = result.savedFile?.id || result.id;
                decryptedFilePath = result.decryptedFilePath || null;
                console.timeEnd("File Queue: Adding File");

                if (!decryptedFilePath) {
                    console.error("❌ Ошибка: decryptedFilePath не найден!");
                    return;
                }
            }

            // Здесь входящий content уже зашифрован на клиенте.
            // Создаем сообщение в БД, сохраняя ciphertext.
            console.time("DB Write: Message");
            const messageRecord = await createMessage(
                req.user!.id,
                chat.id,
                content || "",
                fileId
            );
            console.timeEnd("DB Write: Message");

            // Очистка кеша перед broadcast
            console.time("Redis: Deleting Cache");
            await redisClient.del(`chat:${chat.id}:messages`);
            console.timeEnd("Redis: Deleting Cache");

            const finalFilePath = decryptedFilePath ? normalizeFilePath(decryptedFilePath) : null;
            if (fileId && !finalFilePath) {
                console.error("❌ Ошибка: Файл не был корректно обработан!");
            }

            console.time("Broadcast Message");
            console.log("📢 Отправляем WebSocket-сообщение:", {
                id: messageRecord.id,
                tempId,
                chatId: chat.id,
                content, // ciphertext передается клиенту, который расшифрует
                attachment: fileId
                    ? {
                        fileName: files["file"][0].originalname,
                        fileType: files["file"][0].mimetype,
                        filePath: finalFilePath ? `${BASE_URL}/${finalFilePath}` : null,
                    }
                    : null,
                createdAt: messageRecord.timestamp,
            });

            await broadcastToChatUsers(chat.id, {
                type: "newMessage",
                message: {
                    ...messageRecord.toJSON(),
                    tempId,
                    createdAt: messageRecord.timestamp,
                    content, // ciphertext
                    attachment: fileId
                        ? {
                            fileName: files["file"][0].originalname,
                            fileType: files["file"][0].mimetype,
                            filePath: finalFilePath ? `${BASE_URL}/${finalFilePath}` : null,
                        }
                        : null,
                    user: {
                        id: sender!.id,
                        public_key: sender!.public_key,
                        avatar: sender!.avatar,
                        online: sender!.online,
                        lastOnline: sender!.lastOnline,
                    },
                },
            });
            console.timeEnd("Broadcast Message");

            console.timeEnd("Message Processing");
        })();
    } catch (error) {
        console.error("Ошибка при создании сообщения:", error);
        res.status(500).json({ message: "Ошибка при создании сообщения." });
    }
};

export const getMessagesController = async (req: Request, res: Response) => {
    const { chatId } = req.params;

    try {
        const cacheKey = `chat:${chatId}:messages`;
        const cachedMessages = await redisClient.get(cacheKey);

        if (cachedMessages) {
            console.log(`💾 Отдаем сообщения чата ${chatId} из Redis`);
            return res.status(200).json(JSON.parse(cachedMessages));
        }

        const messages = await getMessages(Number(chatId));

        const decryptedMessages = messages.map((message: Message) => {
            return {
                ...message.toJSON(),
                content: message.content ? decryptMessage(JSON.parse(message.content)) : null
            };
        });

        await redisClient.setEx(cacheKey, 600, JSON.stringify(decryptedMessages)); // Сохраняем в кеш

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

        await updateMessageContent(
            Number(messageId),
            { content: JSON.stringify(encryptedContent), isEdited: true },
            req.user!.id,
            content
        );

        // ❗️ Удаляем кеш сообщений чата
        await redisClient.del(`chat:${message.chatId}:messages`);

        await broadcastToChatUsers(message.chatId, {
            type: 'editMessage',
            message: {
                id: message.id,
                content: content,
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

        await deleteMessageById(Number(messageId), req.user!.id);

        // ❗️ Очищаем кеш сообщений чата
        await redisClient.del(`chat:${message.chatId}:messages`);

        await broadcastToChatUsers(message.chatId, {
            type: 'deleteMessage',
            messageId: Number(messageId),
        });

        res.status(200).json({ message: 'Сообщение успешно удалено.' });
    } catch (error: any) {
        console.error('Ошибка при удалении сообщения:', error);

        if (error.message === 'Сообщение не найдено.') {
            return res.status(404).json({ message: error.message });
        }

        if (error.message === 'Недостаточно прав для удаления сообщения.') {
            return res.status(403).json({ message: error.message });
        }

        res.status(500).json({ message: 'Ошибка при удалении сообщения.' });
    }
};


export const markMessageAsReadController = async (req: UserRequest, res: Response) => {
    console.log('Received params:', req.params);
    console.log('Received body:', req.body);

    const { messageId } = req.params;
    const { isRead } = req.body;

    try {
        const messageIdNumber = Number(messageId);
        const message = await getMessageById(messageIdNumber);

        if (!message) return res.status(404).json({ message: 'Сообщение не найдено.' });

        await Message.update({ isRead }, { where: { id: messageIdNumber } });

        await redisClient.del(`chat:${message.chatId}:messages`);

        await broadcastToChatUsers(message.chatId, {
            type: 'messageRead',
            messageId: message.id,
        });


        res.status(200).json({ message: 'Статус прочтения обновлён.' });
    } catch (error) {
        console.error('Ошибка при обновлении статуса прочтения:', error);
        res.status(500).json({ message: 'Ошибка при обновлении статуса прочтения.' });
    }
};
