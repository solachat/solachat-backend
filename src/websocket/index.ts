import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Chat from '../models/Chat';
import { getUserById, updateUserStatus } from '../services/userService';
import { createMessage } from '../services/messageService';
import { decryptMessage } from '../encryption/messageEncryption';
import { createPrivateChat, deleteChat } from '../services/chatService';

const secret = process.env.JWT_SECRET || 'your_default_secret';

export interface WebSocketUser {
    ws: WebSocket;
    userId: number;
}

export const connectedUsers: WebSocketUser[] = [];

export const initWebSocketServer = (server: any) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', async (ws: WebSocket, req: any) => {
        const token = req.url?.split('token=')[1];

        if (!token) {
            ws.close(4001, 'No token provided');
            console.error('WebSocket connection closed: No token provided.');
            return;
        }

        try {
            const decoded = jwt.verify(token, secret) as { id: number };
            const userId = decoded.id;

            const user = await getUserById(userId);
            if (!user) {
                ws.close(4002, 'User not found');
                console.error('WebSocket connection closed: User not found.');
                return;
            }

            await updateUserStatus(userId, true);

            // Удаляем предыдущее соединение пользователя, если оно есть
            removeUserConnection(userId);

            connectedUsers.push({ ws, userId });
            console.log(`User ${user.username} подключен. Всего пользователей: ${connectedUsers.length}`);

            // Обработка закрытия соединения
            ws.on('close', async (code, reason) => {
                console.log(`User ${user.username} disconnected with code ${code}, reason: ${reason}`);
                await updateUserStatus(userId, false);
                removeUserConnection(userId);
            });

            // Обработка ошибок
            ws.on('error', (error) => {
                console.error(`WebSocket error for user ${user.username}:`, error);
            });

        } catch (error) {
            console.error('Error processing WebSocket connection:', error);
            ws.close(4003, 'Invalid token');
        }
    });
};

const handleChatCreation = async (userId: number, parsedMessage: any) => {
    const { user1Id, user2Id } = parsedMessage;

    const chat = await createPrivateChat(user1Id, user2Id);
    await broadcastChatCreation(chat);
};

const handleChatDeletion = async (userId: number, chatId: number) => {
    const chat = await Chat.findByPk(chatId);
    if (chat) {
        await deleteChat(chatId, userId, 'admin', chat.isGroup);
        await broadcastChatDeletion(chatId);
    }
};

const getChatAndUsers = async (chatId: number) => {
    console.time('Database Query (Chat and Users)');
    const chat = await Chat.findByPk(chatId, {
        include: [{ model: User, as: 'users', attributes: ['id', 'username', 'avatar'] }]
    });

    if (!chat || !chat.users) {
        console.error('Chat or users not found');
        return null;
    }

    console.timeEnd('Database Query (Chat and Users)');
    return chat;
};

const handleMessage = async (userId: number, parsedMessage: any): Promise<void> => {
    try {
        const { chatId, content } = parsedMessage;

        const chat = await getChatAndUsers(chatId);
        if (!chat || !chat.users || !isUserInChat(chat.users, userId)) return;

        const sender = await getUserById(userId);
        if (!sender) return;

        const message = await createAndBroadcastMessage(chatId, userId, content, sender);
    } catch (error) {
        console.error(`Error handling message from user ${userId}:`, error);
    }
};

const createAndBroadcastMessage = async (chatId: number, userId: number, content: string, sender: User) => {
    const message = await createMessage(userId, chatId, content, null, sender);
    await broadcastMessage(chatId, message);
    return message;
};

const broadcastChatCreation = async (chat: Chat) => {
    const participants = await getChatParticipants(chat.id);

    if (!participants || !participants.users || participants.users.length === 0) {
        console.error('No participants found for this chat');
        return;
    }

    const chatPayload = JSON.stringify({
        type: 'chatCreated',
        chatId: chat.id,
        name: chat.name,
        users: participants.users.map(user => ({
            id: user.id,
            username: user.username,
            avatar: user.avatar || null
        }))
    });

    broadcastToParticipants(participants.users, chat.id, chatPayload, 'chatCreated');
};

const broadcastChatDeletion = async (chatId: number) => {
    const participants = await getChatParticipants(chatId);
    if (!participants || !participants.users) return;

    const payload = JSON.stringify({
        type: 'chatDeleted',
        chatId
    });

    broadcastToParticipants(participants.users, chatId, payload, 'chatDeleted');
};

const broadcastMessage = async (chatId: number, message: any) => {
    const sender = await getUserById(message.userId);
    if (!sender) return;

    const chat = await getChatParticipants(chatId);
    if (!chat || !chat.users) return;

    const messagePayload = createMessagePayload(message, sender);
    broadcastToParticipants(chat.users, chatId, messagePayload, 'newMessage');
};

const createMessagePayload = (message: any, sender: User) => {
    return JSON.stringify({
        type: 'newMessage',
        message: {
            id: message.id,
            content: decryptMessage(JSON.parse(message.content)),
            createdAt: message.createdAt,
            sender: {
                id: sender.id,
                username: sender.username,
                avatar: sender.avatar
            }
        }
    });
};

const broadcastToParticipants = (participants: User[], chatId: number, payload: string, type: string) => {
    const participantIds = participants.map(user => user.id);
    connectedUsers.forEach(({ ws, userId }) => {
        if (ws.readyState === WebSocket.OPEN && participantIds.includes(userId)) {
            ws.send(JSON.stringify({
                type,
                chatId,
                ...JSON.parse(payload)
            }));
        }
    });
};

const getChatParticipants = async (chatId: number) => {
    return await Chat.findByPk(chatId, { include: [{ model: User, attributes: ['id', 'username', 'avatar'] }] });
};

const isUserInChat = (users: User[], userId: number) => {
    return users.some(user => user.id === userId);
};

const removeUserConnection = (userId: number) => {
    const index = connectedUsers.findIndex(user => user.userId === userId);
    if (index !== -1) connectedUsers.splice(index, 1);
};
