import { Request, Response } from 'express';
import {
    createPrivateChat,
    createGroupChat,
    getChatById,
    getChatWithMessages,
    getChatsForUser,
    deleteChat,
    addUsersToGroupChat,
    kickUserFromChat,
    assignRole,
    getUserRoleInChat,
    updateChatSettings
} from '../services/chatService';
import { UserRequest } from '../types/types';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import UserChats from '../models/UserChats';
import Chat from '../models/Chat';

const extractUserIdFromToken = (req: Request): number | null => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { id: number };
        return decoded.id;
    } catch {
        return null;
    }
};

export const createPrivateChatController = async (req: Request, res: Response) => {
    const { user1Id, user2Id } = req.body;

    if (user1Id === user2Id) {
        return res.status(400).json({ message: 'Нельзя создать чат с самим собой' });
    }

    try {
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
    const creatorId = extractUserIdFromToken(req);

    if (!creatorId) {
        return res.status(401).json({ message: 'Токен отсутствует или неверный' });
    }

    if (!userIds.includes(creatorId)) {
        userIds.push(creatorId);
    }

    const avatarUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}` : undefined;

    try {
        const chat = await createGroupChat(userIds, groupName, creatorId, avatarUrl);
        return res.status(201).json(chat);
    } catch (error) {
        console.error('Ошибка при создании группы:', (error as Error).message);
        return res.status(500).json({ message: 'Не удалось создать группу.' });
    }
};

export const getChatController = async (req: Request, res: Response) => {
    const chatId = Number(req.params.chatId);
    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    try {
        const chat = await getChatById(chatId);
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat by ID:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chat' });
    }
};

export const getChatsController = async (req: UserRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ message: 'Invalid or missing User ID' });
    }

    try {
        const chats = await getChatsForUser(userId);
        return res.status(200).json(chats);
    } catch (error) {
        console.error('Error fetching chats:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chats' });
    }
};

export const getChatWithMessagesController = async (req: UserRequest, res: Response) => {
    const chatId = Number(req.params.chatId);
    const userId = req.user?.id;

    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const chat = await getChatWithMessages(chatId, userId);
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Error fetching chat with messages:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to fetch chat with messages' });
    }
};

export const deleteChatController = async (req: Request, res: Response) => {
    const chatId = Number(req.params.chatId);
    const userId = req.user?.id;

    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Invalid chat ID' });
    }

    if (!userId) {
        return res.status(403).json({ message: 'User information is missing' });
    }

    try {
        const userChatRecord = await UserChats.findOne({ where: { userId, chatId } });
        if (!userChatRecord) {
            return res.status(404).json({ message: 'User is not a member of this chat' });
        }

        const chat = await Chat.findOne({ where: { id: chatId } });
        if (!chat) {
            return res.status(404).json({ message: 'Chat not found' });
        }

        await deleteChat(chatId, userId, userChatRecord.role, chat.isGroup);
        return res.status(200).json({ message: 'Chat deleted successfully' });
    } catch (error) {
        console.error('Error deleting chat:', (error as Error).message);
        return res.status(500).json({ message: 'Failed to delete chat' });
    }
};

export const addUsersToChatController = async (req: Request, res: Response) => {
    const { chatId, newUserIds } = req.body;
    const userId = req.user?.id;

    if (!chatId || !Array.isArray(newUserIds) || newUserIds.length === 0) {
        return res.status(400).json({ message: 'Неверные данные' });
    }

    try {
        await addUsersToGroupChat(chatId, newUserIds, userId!);
        return res.status(200).json({ message: 'Участники успешно добавлены' });
    } catch (error) {
        console.error('Ошибка при добавлении участников:', error);
        return res.status(500).json({ message: 'Не удалось добавить участников в чат' });
    }
};

export const kickUserController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { userIdToKick } = req.body;
    const userId = req.user?.id;

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
        return res.status(200).json({ message: 'Участник успешно удален из чата' });
    } catch (error) {
        console.error('Ошибка при удалении участника:', error);
        return res.status(500).json({ message: 'Не удалось удалить участника' });
    }
};

export const assignRoleController = async (req: Request, res: Response) => {
    const { userIdToAssign, role } = req.body;
    const chatId = Number(req.params.chatId);

    if (!chatId || !userIdToAssign || !role) {
        return res.status(400).json({ message: 'Неверные данные' });
    }

    try {
        await assignRole(chatId, userIdToAssign, role);
        return res.status(200).json({ message: 'Роль успешно назначена' });
    } catch (error) {
        console.error('Ошибка при назначении роли:', error);
        return res.status(500).json({ message: 'Не удалось назначить роль' });
    }
};

export const updateChatSettingsController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { groupName } = req.body;
    const avatar = req.file;

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID is required' });
    }

    const userId = extractUserIdFromToken(req);
    if (!userId) {
        return res.status(401).json({ message: 'Token is missing or invalid' });
    }

    const avatarUrl = avatar ? `${req.protocol}://${req.get('host')}/uploads/images/${avatar.filename}` : undefined;

    try {
        const updatedChat = await updateChatSettings(Number(chatId), userId, groupName, avatarUrl);
        return res.status(200).json({ message: 'Chat settings updated successfully', chat: updatedChat });
    } catch (error) {
        console.error('Error updating chat settings:', error);
        return res.status(500).json({ message: 'Failed to update chat settings' });
    }
};
