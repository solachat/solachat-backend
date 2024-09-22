import { Request, Response } from 'express';
import {
    createPrivateChat,
    createGroupChat,
    getChatById,
    getChatWithMessages,
    getChatsForUser
} from '../services/chatService';
import { UserRequest } from '../types/types';

// Создание приватного чата
export const createPrivateChatController = async (req: Request, res: Response) => {
    const { user1Id, user2Id } = req.body;
    try {
        if (user1Id === user2Id) {
            return res.status(400).json({ message: 'Нельзя создать чат с самим собой' });
        }

        const chat = await createPrivateChat(user1Id, user2Id);
        return res.status(201).json(chat);
    } catch (error) {
        console.error('Error creating private chat:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to create chat' });
    }
};

// Создание группового чата
export const createGroupChatController = async (req: Request, res: Response) => {
    const { userIds, chatName } = req.body;
    try {
        const chat = await createGroupChat(userIds, chatName);
        return res.status(201).json(chat);
    } catch (error) {
        console.error('Error creating group chat:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to create group chat' });
    }
};

// Получение чата по ID
export const getChatController = async (req: Request, res: Response) => {
    const { chatId } = req.params;

    const chatIdNumber = Number(chatId);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        const chat = await getChatById(chatIdNumber);
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chat' });
    }
};

// Получение чатов пользователя
export const getChatsController = async (req: UserRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId || isNaN(Number(userId))) {
            return res.status(400).json({ message: 'Invalid or missing User ID' });
        }

        const chats = await getChatsForUser(Number(userId));
        return res.status(200).json(chats);
    } catch (error) {
        console.error('Error fetching chats:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chats' });
    }
};

// Получение чата с сообщениями
export const getChatWithMessagesController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;

    const chatIdNumber = Number(chatId);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const chat = await getChatWithMessages(chatIdNumber, userId);
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat with messages:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chat with messages' });
    }
};
