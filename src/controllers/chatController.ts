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
import {wss} from "../websocket";
import {getUserById} from "../services/userService";

const broadcastToClients = (type: string, payload: object) => {
    const messagePayload = JSON.stringify({ type, ...payload });
    wss.clients.forEach((client: any) => {
        if (client.readyState === client.OPEN) {
            client.send(messagePayload);
        }
    });
};

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

        const user1 = await getUserById(user1Id);
        const user2 = await getUserById(user2Id);

        if (!user1 || !user2) {
            return res.status(404).json({ message: 'Один или оба пользователя не найдены.' });
        }

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
                    username: user1.username,
                    avatar: user1.avatar,
                    online: user1.online
                },
                {
                    id: user2.id,
                    username: user2.username,
                    avatar: user2.avatar,
                    online: user2.online
                }
            ]
        };

        broadcastToClients('chatCreated', { chat: chatWithUsers });

        res.status(201).json(chatWithUsers);
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        res.status(500).json({ message: 'Ошибка создания чата.' });
    }
};



export const createGroupChatController = async (req: Request, res: Response) => {
    const { groupName, selectedUsers } = req.body;

    if (!groupName || !selectedUsers || selectedUsers.length === 0) {
        return res.status(400).json({ message: 'Не все обязательные поля заполнены' });
    }

    try {
        const userIds = selectedUsers.map((userId: string) => parseInt(userId, 10));
        const creatorId = extractUserIdFromToken(req);

        if (!creatorId) {
            return res.status(401).json({ message: 'Токен отсутствует или неверный' });
        }

        if (!userIds.includes(creatorId)) {
            userIds.push(creatorId);
        }

        const avatarUrl = req.file ? `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}` : undefined;

        const chat = await createGroupChat(userIds, groupName, creatorId, avatarUrl);

        broadcastToClients('groupChatCreated', { chat });

        res.status(201).json(chat);
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        res.status(500).json({ message: 'Ошибка создания группы.' });
    }
};

export const getChatController = async (req: Request, res: Response) => {
    const chatId = Number(req.params.chatId);
    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Неверный идентификатор чата' });
    }

    try {
        const chat = await getChatById(chatId);
        return res.status(200).json(chat);
    } catch (error) {
        console.error('Ошибка получения чата:', error);
        res.status(500).json({ message: 'Ошибка получения чата' });
    }
};

export const getChatsController = async (req: UserRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
        return res.status(400).json({ message: 'Недействительный или отсутствующий ID пользователя' });
    }

    try {
        const chats = await getChatsForUser(userId);
        res.status(200).json(chats);
    } catch (error) {
        console.error('Ошибка получения чатов:', error);
        res.status(500).json({ message: 'Ошибка получения чатов' });
    }
};

export const getChatWithMessagesController = async (req: UserRequest, res: Response) => {
    const chatId = Number(req.params.chatId);
    const userId = req.user?.id;

    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Неверный идентификатор чата' });
    }

    if (!userId) {
        return res.status(401).json({ message: 'Не авторизован' });
    }

    try {
        const chat = await getChatWithMessages(chatId, userId);
        res.status(200).json(chat);
    } catch (error) {
        console.error('Ошибка получения чата с сообщениями:', error);
        res.status(500).json({ message: 'Ошибка получения чата с сообщениями' });
    }
};

export const deleteChatController = async (req: Request, res: Response) => {
    const chatId = Number(req.params.chatId);
    const userId = req.user?.id;

    if (isNaN(chatId)) {
        return res.status(400).json({ message: 'Неверный идентификатор чата' });
    }

    if (!userId) {
        return res.status(403).json({ message: 'Информация о пользователе отсутствует' });
    }

    try {
        const userChatRecord = await UserChats.findOne({ where: { userId, chatId } });
        if (!userChatRecord) {
            return res.status(404).json({ message: 'Пользователь не является участником этого чата' });
        }

        const chat = await Chat.findOne({ where: { id: chatId } });
        if (!chat) {
            return res.status(404).json({ message: 'Чат не найден' });
        }

        await deleteChat(chatId, userId, userChatRecord.role, chat.isGroup);

        broadcastToClients('chatDeleted', { chatId });

        res.status(200).json({ message: 'Чат успешно удалён.' });
    } catch (error) {
        console.error('Ошибка удаления чата:', error);
        res.status(500).json({ message: 'Ошибка удаления чата.' });
    }
};

export const addUsersToChatController = async (req: Request, res: Response) => {
    const { chatId, newUserIds } = req.body;
    const userId = req.user?.id;

    if (!chatId || !Array.isArray(newUserIds) || newUserIds.length === 0) {
        return res.status(400).json({ message: 'Неверные данные.' });
    }

    try {
        await addUsersToGroupChat(chatId, newUserIds, userId!);

        broadcastToClients('usersAddedToChat', { chatId, newUserIds });

        res.status(200).json({ message: 'Пользователи успешно добавлены в чат.' });
    } catch (error) {
        console.error('Ошибка добавления пользователей в чат:', error);
        res.status(500).json({ message: 'Ошибка добавления пользователей в чат.' });
    }
};

export const kickUserController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { userIdToKick } = req.body;
    const userId = req.user?.id;

    if (!chatId || !userIdToKick) {
        return res.status(400).json({ message: 'Неверные данные.' });
    }

    try {
        const userRole = await getUserRoleInChat(userId!, Number(chatId));
        if (userRole !== 'owner' && userRole !== 'admin') {
            return res.status(403).json({ message: 'Нет прав для удаления пользователей.' });
        }

        const userToKick = await User.findByPk(userIdToKick);
        if (!userToKick) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }

        await kickUserFromChat(Number(chatId), userIdToKick, userId!);

        broadcastToClients('userKickedFromChat', { chatId, userIdToKick });

        res.status(200).json({ message: 'Пользователь успешно удалён.' });
    } catch (error) {
        console.error('Ошибка удаления пользователя из чата:', error);
        res.status(500).json({ message: 'Ошибка удаления пользователя из чата.' });
    }
};

export const assignRoleController = async (req: Request, res: Response) => {
    const { userIdToAssign, role } = req.body;
    const { chatId } = req.params;

    try {
        await assignRole(Number(chatId), userIdToAssign, role);

        broadcastToClients('roleAssigned', { chatId, userIdToAssign, role });

        res.status(200).json({ message: 'Роль успешно назначена.' });
    } catch (error) {
        console.error('Ошибка назначения роли:', error);
        res.status(500).json({ message: 'Ошибка назначения роли.' });
    }
};

export const updateChatSettingsController = async (req: Request, res: Response) => {
    const { chatId } = req.params;
    const { groupName } = req.body;
    const avatar = req.file;

    try {
        const avatarUrl = avatar ? `${req.protocol}://${req.get('host')}/uploads/images/${avatar.filename}` : undefined;

        const updatedChat = await updateChatSettings(Number(chatId), req.user!.id, groupName, avatarUrl);

        broadcastToClients('chatSettingsUpdated', { chat: updatedChat });

        res.status(200).json({ message: 'Настройки чата успешно обновлены.' });
    } catch (error) {
        console.error('Ошибка обновления настроек чата:', error);
        res.status(500).json({ message: 'Ошибка обновления настроек чата.' });
    }
};

export const createFavoriteChatController = async (req: Request, res: Response) => {
    const userId = extractUserIdFromToken(req);

    if (!userId) {
        return res.status(401).json({ message: 'Не авторизован' });
    }

    try {
        const existingFavoriteChat = await Chat.findOne({
            where: { isFavorite: true, isGroup: false },
            include: [{
                model: User,
                as: 'users',
                where: { id: userId },
                through: { attributes: [] },
            }],
        });

        if (existingFavoriteChat) {
            return res.status(200).json(existingFavoriteChat);
        }

        const newFavoriteChat = await Chat.create({ isFavorite: true, isGroup: false });

        await UserChats.create({
            userId,
            chatId: newFavoriteChat.id,
            role: 'owner',
        });

        broadcastToClients('favoriteChatUpdated', { chat: newFavoriteChat });

        res.status(201).json(newFavoriteChat);
    } catch (error) {
        console.error('Ошибка создания избранного чата:', error);
        res.status(500).json({ message: 'Ошибка создания избранного чата.' });
    }
};
