import { Request, Response } from 'express';
import {
    createPrivateChat,
    createGroupChat,
    getChatById,
    getChatWithMessages,
    getChatsForUser
} from '../services/chatService';
import { UserRequest } from '../types/types';

export const createPrivateChatController = async (req: Request, res: Response) => {
    const { user1Id, user2Id } = req.body;
    try {
        // Проверяем, что ID пользователей не совпадают
        if (user1Id === user2Id) {
            return res.status(400).json({ message: 'Нельзя создать чат с самим собой' });
        }

        const chat = await createPrivateChat(user1Id, user2Id);
        res.status(201).json(chat);
    } catch (error) {
        console.error('Error creating private chat:', (error as Error).message);
        res.status(500).json({ message: 'Failed to create chat' });
    }
};

export const createGroupChatController = async (req: Request, res: Response) => {
    const { userIds, chatName } = req.body;
    try {
        const chat = await createGroupChat(userIds, chatName);
        res.status(201).json(chat);
    } catch (error) {
        console.error('Error creating group chat:', (error as Error).message);
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getChatController = async (req: Request, res: Response) => {
    const { chatId } = req.params;

    const chatIdNumber = Number(chatId);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        const chat = await getChatById(chatIdNumber);
        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', (error as Error).message);
        res.status(500).json({ message: 'Failed to fetch chat' });
    }
};

export const getChatsController = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        if (!userId || isNaN(Number(userId))) {
            return res.status(400).json({ message: 'Invalid or missing User ID' });
        }

        const chats = await getChatsForUser(Number(userId));
        res.status(200).json(chats);
    } catch (error) {
        console.error('Error fetching chats:', (error as Error).message);
        res.status(500).json({ message: 'Failed to fetch chats' });
    }
};

export const getChatWithMessagesController = async (req: UserRequest, res: Response) => {
    const { chatId } = req.params;

    const chatIdNumber = Number(chatId);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        // Получаем userId из req.user
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const chat = await getChatWithMessages(chatIdNumber, userId);
        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat with messages:', (error as Error).message);
        res.status(500).json({ message: 'Failed to fetch chat with messages' });
    }
};
