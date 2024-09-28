import { Request, Response } from 'express';
import {
    createPrivateChat,
    createGroupChat,
    getChatById,
    getChatWithMessages,
    getChatsForUser,
    deleteChat, addUsersToGroupChat, kickUserFromChat, assignRole, getUserRoleInChat, updateChatSettings
} from '../services/chatService';
import { UserRequest } from '../types/types';
import multer from 'multer';
import jwt from "jsonwebtoken";
import User from "../models/User";
import {uploadFileController} from "./fileController";
import UserChats from "../models/UserChats";
import Chat from "../models/Chat";
import chat from "../models/Chat";

const upload = multer();

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

export const createGroupChatController = async (req: Request, res: Response) => {
    const { groupName, selectedUsers } = req.body;

    if (!groupName || !Array.isArray(selectedUsers) || selectedUsers.length === 0) {
        return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
    }

    const userIds = selectedUsers.map((userId: string) => parseInt(userId, 10));
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Токен отсутствует' });
    }

    let creatorId: number;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
        creatorId = decoded.id;
    } catch (error) {
        return res.status(403).json({ message: 'Неверный токен' });
    }

    if (!userIds.includes(creatorId)) {
        userIds.push(creatorId);
    }

    let avatarUrl: string | undefined;
    if (req.file) {
        avatarUrl = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`; // Генерация URL аватара
    }

    try {
        const chat = await createGroupChat(userIds, groupName, creatorId, avatarUrl);
        return res.status(201).json(chat);
    } catch (error) {
        console.error('Ошибка при создании группы:', (error as Error).message);
        return res.status(500).json({ message: 'Не удалось создать группу.' });
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
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chat' });
    }
};

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

export const deleteChatController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const userId = req.user?.id;

    try {
        const chatIdNumber = Number(chatId);
        if (isNaN(chatIdNumber)) {
            return res.status(400).json({ message: 'Invalid chat ID' });
        }

        if (!userId) {
            return res.status(403).json({ message: 'User information is missing' });
        }

        const userChatRecord = await UserChats.findOne({ where: { userId, chatId: chatIdNumber } });
        if (!userChatRecord) {
            return res.status(404).json({ message: 'User is not a member of this chat' });
        }

        const userRole = userChatRecord.role;

        const chat = await Chat.findOne({ where: { id: chatIdNumber } });

        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        const isGroup = chat.isGroup;

        await deleteChat(chatIdNumber, userId, userRole, isGroup);

        return res.status(200).json({ message: 'Chat deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to delete chat' });
    }
};


export const addUsersToChatController = async (req: Request, res: Response) => {
    const { chatId, newUserIds } = req.body;
    const userId = req.user?.id;

    if (!chatId || !newUserIds || !Array.isArray(newUserIds) || newUserIds.length === 0) {
        return res.status(400).json({ message: 'Неверные данные' });
    }

    try {
        await addUsersToGroupChat(chatId, newUserIds, userId!);
        res.status(200).json({ message: 'Участники успешно добавлены' });
    } catch (error) {
        console.error('Ошибка при добавлении участников:', error);
        res.status(500).json({ message: 'Не удалось добавить участников в чат' });
    }
};

export const kickUserController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { userIdToKick } = req.body;
    const userId = req.user?.id;

    console.log("Получен запрос на удаление:", chatId, userIdToKick, userId);

    if (!chatId || !userIdToKick) {
        return res.status(400).json({ message: 'Неверные данные' });
    }

    try {
        const userRole = await getUserRoleInChat(userId!, Number(chatId));

        if (userRole !== 'owner' && userRole !== 'admin') {
            return res.status(403).json({ message: 'У вас нет прав для удаления участников из этого чата' });
        }

        const userToKick = await User.findByPk(userIdToKick);
        if (!userToKick) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }

        await kickUserFromChat(Number(chatId), userIdToKick, userId!);
        res.status(200).json({ message: 'Участник успешно удален из чата' });
    } catch (error) {
        console.error('Ошибка при удалении участника:', error);
        res.status(500).json({ message: 'Не удалось удалить участника' });
    }
};


export const assignRoleController = async (req: Request, res: Response) => {
    const { userIdToAssign, role } = req.body;
    const { chatId } = req.params;
    const userId = req.user?.id;

    if (!chatId || !userIdToAssign || !role) {
        return res.status(400).json({ message: 'Неверные данные' });
    }

    try {
        await assignRole(Number(chatId), userIdToAssign, role);
        res.status(200).json({ message: 'Роль успешно назначена' });
    } catch (error) {
        console.error('Ошибка при назначении роли:', error);
        res.status(500).json({ message: 'Не удалось назначить роль' });
    }
};

export const updateChatSettingsController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { groupName } = req.body;
    const avatar = req.file;

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID is required' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Token is missing' });
    }

    let userId: number;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
        userId = decoded.id;
    } catch (error) {
        return res.status(403).json({ message: 'Invalid token' });
    }

    console.log('Extracted userId:', userId);
    console.log('Updating chat:', { chatId, groupName, avatar });

    const avatarUrl = avatar ? `${req.protocol}://${req.get('host')}/uploads/images/${avatar.filename}` : undefined;

    try {
        const updatedChat = await updateChatSettings(Number(chatId), userId, groupName, avatarUrl);
        return res.status(200).json({ message: 'Chat settings updated successfully', chat: updatedChat });
    } catch (error) {
        console.error('Error updating chat settings:', error);
        return res.status(500).json({ message: 'Failed to update chat settings' });
    }
};

