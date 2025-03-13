import Message from '../models/Message';
import User from '../models/User';
import File from '../models/File';
import { encryptMessage } from "../encryption/messageEncryption";
import redisClient from '../config/redisClient';
import {broadcastToClients} from "../controllers/messageController";

const CHAT_CACHE_EXPIRY = 60 * 5;

export const createMessage = async (
    userId: number,
    chatId: number,
    content: string,
    fileId: number | null,
    user: User
) => {
    const encryptedContent = encryptMessage(content);

    console.time('DB Write: Message');
    const message = await Message.create({
        chatId,
        userId,
        content: JSON.stringify(encryptedContent),
        fileId: fileId || undefined,
        timestamp: new Date().toISOString(),
    });
    console.timeEnd('DB Write: Message');

    const cacheKey = `userChats:${userId}`;
    const cachedChats = await redisClient.get(cacheKey);

    if (cachedChats) {
        const chats = JSON.parse(cachedChats);

        const chatIndex = chats.findIndex((chat: any) => chat.id === chatId);
        if (chatIndex !== -1) {
            chats[chatIndex].messages.push({
                ...message.toJSON(),
                content,
                attachment: null,
                user: {
                    id: user.id,
                    username: user.username,
                    public_key: user.public_key,
                    avatar: user.avatar,
                },
            });

            await redisClient.setEx(cacheKey, CHAT_CACHE_EXPIRY, JSON.stringify(chats));
        } else {
            await redisClient.del(cacheKey);
        }
    }

    return message;
};

<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
export const getMessages = async (chatId: number) => {
    const cacheKey = `chat:${chatId}:messages`;

    const cachedMessages = await redisClient.get(cacheKey);
    if (cachedMessages) {
        console.log(`💾 Отдаем сообщения чата ${chatId} из Redis`);
        return JSON.parse(cachedMessages);
    }

    console.time('DB Query: Messages');
    const messages = await Message.findAll({
        where: { chatId },
        include: [
            { model: User, attributes: ['id', 'username', 'avatar'] },
            { model: File, as: 'attachment', attributes: ['fileName', 'filePath', 'fileType'] },
        ],
        order: [['createdAt', 'ASC']]
    });
    console.timeEnd('DB Query: Messages');

    await redisClient.set(cacheKey, JSON.stringify(messages), { EX: 600 });

    return messages;
};

export const getMessageById = async (messageId: number) => {
    const cacheKey = `message:${messageId}`;

    const cachedMessage = await redisClient.get(cacheKey);
    if (cachedMessage) {
        console.log(`💾 Отдаем сообщение ${messageId} из Redis`);
        return JSON.parse(cachedMessage);
    }

    console.time('DB Query: MessageById');
    const message = await Message.findByPk(messageId);
    console.timeEnd('DB Query: MessageById');

    if (message) {
        await redisClient.set(cacheKey, JSON.stringify(message), { EX: 1800 });
    }

    return message;
};

export const deleteMessageById = async (messageId: number, userId: number) => {
    const message = await Message.findByPk(messageId);
    if (!message) {
        throw new Error('Сообщение не найдено.');
    }

    if (message.userId !== userId) {
        throw new Error('Недостаточно прав для удаления сообщения.');
    }

    await Message.destroy({ where: { id: messageId } });

    const cacheKey = `userChats:${userId}`;
    const cachedChats = await redisClient.get(cacheKey);

    if (cachedChats) {
        const chats = JSON.parse(cachedChats);
        let chatUpdated = false;

        chats.forEach((chat: any) => {
            const originalLength = chat.messages.length;
            chat.messages = chat.messages.filter((msg: any) => msg.id !== messageId);
            if (chat.messages.length !== originalLength) {
                chatUpdated = true;
            }
        });

        if (chatUpdated) {
            await redisClient.setEx(cacheKey, 3600, JSON.stringify(chats));
        }
    }

    broadcastToClients('deleteMessage', {
        messageId: message.id,
        chatId: message.chatId,
    });

    const messageCacheKey = `message:${messageId}`;
    await redisClient.del(messageCacheKey);

    return true;
};

export const updateMessageContent = async (messageId: number, updates: { content: string; isEdited: boolean }) => {
    await Message.update(updates, { where: { id: messageId } });

    const cacheKey = `message:${messageId}`;
    await redisClient.del(cacheKey);
};

