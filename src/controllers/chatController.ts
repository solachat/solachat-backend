import { Request, Response } from 'express';
import {
    createPrivateChat,
    createGroupChat,
    getChatById,
    getChatWithMessages,
    getChatsForUser
} from '../services/chatService';
import { UserRequest } from '../types/types';
import Chat from '../models/Chat';
import User from '../models/User';

export const createPrivateChatController = async (req: Request, res: Response) => {
    const { user1Id, user2Id } = req.body;
    try {
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

export const getChatsController = async (req: UserRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        console.log('Received request to fetch chats for user:', userId);

        if (!userId) {
            console.error('User ID is missing or unauthorized');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const chats = await getChatsForUser(userId);
        console.log('Fetched chats:', chats);

        res.status(200).json(chats.length ? chats : []);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const getChatWithMessagesController = async (req: Request, res: Response) => {
    const { chatId } = req.params;

    const chatIdNumber = Number(chatId);
    if (isNaN(chatIdNumber)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        const chat = await getChatWithMessages(chatIdNumber);
        res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat with messages:', (error as Error).message);
        res.status(500).json({ message: 'Failed to fetch chat with messages' });
    }
};
