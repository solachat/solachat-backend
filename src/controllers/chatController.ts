import { Request, Response } from 'express';
import { createPrivateChat, createGroupChat, getChatById } from '../services/chatService';
import Chat from "../models/Chat";
import User from "../models/User";
import { UserRequest } from "../types/types";

export const createPrivateChatController = async (req: Request, res: Response) => {
    const { user1Id, user2Id } = req.body;
    console.log('Creating private chat:', { user1Id, user2Id });
    try {
        const chat = await createPrivateChat(user1Id, user2Id);
        console.log('Private chat created successfully:', chat);
        res.status(201).json(chat);
    } catch (error) {
        const err = error as Error;
        console.error('Error creating private chat:', err.message);
        res.status(500).json({ message: err.message });
    }
};

export const createGroupChatController = async (req: Request, res: Response) => {
    const { userIds, chatName } = req.body;
    console.log('Creating group chat:', { userIds, chatName });
    try {
        const chat = await createGroupChat(userIds, chatName);
        console.log('Group chat created successfully:', chat);
        res.status(201).json(chat);
    } catch (error) {
        const err = error as Error;
        console.error('Error creating group chat:', err.message);
        res.status(500).json({ message: err.message });
    }
};

export const getChatController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    console.log('Fetching chat by ID:', chatId);
    try {
        const chat = await getChatById(Number(chatId));
        if (!chat) {
            console.log('Chat not found:', chatId);
            return res.status(404).json({ message: 'Chat not found' });
        }
        console.log('Chat fetched successfully:', chat);
        res.status(200).json(chat);
    } catch (error) {
        const err = error as Error;
        console.error('Error fetching chat by ID:', err.message);
        res.status(500).json({ message: err.message });
    }
};

export const getChatsController = async (req: UserRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        console.log('Fetching chats for user:', userId);

        if (!userId) {
            console.log('Unauthorized request: No user ID found in request');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const chats = await Chat.findAll({
            include: [
                {
                    model: User,
                    as: 'users',
                    where: { id: userId },
                    attributes: []
                }
            ]
        });

        console.log('Fetched chats:', chats.length ? chats : 'No chats found');

        if (!chats.length) {
            console.log('No chats found for user:', userId);
            return res.status(200).json([]);
        }

        res.status(200).json(chats);
    } catch (error) {
        const err = error as Error;
        console.error('Error fetching chats:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
};
