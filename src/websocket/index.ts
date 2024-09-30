import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getUserById } from '../services/userService';
import Message from '../models/Message';
import { createMessage } from '../services/messageService';
import Chat from '../models/Chat';
import { decryptMessage } from '../encryption/messageEncryption';

const secret = process.env.JWT_SECRET || 'your_default_secret';

interface WebSocketUser {
    ws: WebSocket;
    userId: number;
}

const connectedUsers: WebSocketUser[] = [];

export const initWebSocketServer = (server: any) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', async (ws: WebSocket, req: any) => {
        const token = req.url?.split('token=')[1];

        if (!token) {
            ws.close(4001, 'No token provided');
            return;
        }

        try {
            const decoded = jwt.verify(token, secret) as { id: number };
            const userId = decoded.id;

            const user = await getUserById(userId);
            if (!user) {
                ws.close(4002, 'User not found');
                return;
            }

            await updateUserStatus(userId, true);
            console.log(`User ${user.username} is now online`);

            connectedUsers.push({ ws, userId });

            ws.on('message', async (message: string) => {
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.type === 'heartbeat') {
                    console.log(`Received heartbeat from user ${user.username}`);
                } else {
                    await handleMessage(userId, parsedMessage);
                }
            });

            ws.on('close', async (code, reason) => {
                console.log(`User ${user.username} disconnected with code ${code}, reason: ${reason}`);
                removeUserConnection(userId);
                await updateUserStatus(userId, false);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for user ${user.username}:`, error);
            });

        } catch (error) {
            console.error('Error processing WebSocket connection:', error);
            ws.close(4003, 'Invalid token');
        }
    });
};

const handleMessage = async (userId: number, parsedMessage: any): Promise<void> => {
    try {
        console.time('Message Handling');
        const { chatId, content } = parsedMessage;

        const chat = await getChatAndUsers(chatId);
        if (!chat || !chat.users || !isUserInChat(chat.users, userId)) return;

        const sender = await getUserById(userId);
        if (!sender) return;

        const message = await createAndBroadcastMessage(chatId, userId, content, sender);

        console.timeEnd('Message Handling');
    } catch (error) {
        console.error(`Error handling message from user ${userId}:`, error);
    }
};

const createAndBroadcastMessage = async (chatId: number, userId: number, content: string, sender: User) => {
    console.time('Message Encryption');
    const message = await createMessage(userId, chatId, content, null, sender);
    console.timeEnd('Message Encryption');

    console.time('Message Broadcasting');
    await broadcastMessage(chatId, message);
    console.timeEnd('Message Broadcasting');

    return message;
};

const broadcastMessage = async (chatId: number, message: Message) => {
    try {
        const sender = await getUserById(message.userId);
        if (!sender) return;

        const chat = await getChatParticipants(chatId);
        if (!chat || !chat.users) return;

        const messagePayload = createMessagePayload(message, sender);

        broadcastToParticipants(chat.users, messagePayload);
    } catch (error) {
        console.error('Error broadcasting message:', error);
    }
};

const createMessagePayload = (message: Message, sender: User) => {
    return JSON.stringify({
        type: 'newMessage',
        message: {
            id: message.id,
            content: decryptMessage(JSON.parse(message.content)),
            createdAt: message.createdAt,
            sender: {
                id: sender.id,
                username: sender.username,
                realname: sender.realname,
                avatar: sender.avatar,
                online: sender.online,
            }
        }
    });
};

const broadcastToParticipants = (participants: User[], payload: string) => {
    const participantIds = participants.map(user => user.id);
    connectedUsers.forEach(({ ws, userId }) => {
        if (ws.readyState === WebSocket.OPEN && participantIds.includes(userId)) {
            ws.send(payload);
        }
    });
};

const getChatAndUsers = async (chatId: number) => {
    console.time('Database Query (Chat and Users)');
    const chat = await Chat.findByPk(chatId, {
        include: [{ model: User, as: 'users', attributes: ['id', 'username', 'avatar'] }],
    });
    console.timeEnd('Database Query (Chat and Users)');
    return chat;
};

const getChatParticipants = async (chatId: number) => {
    return await Chat.findByPk(chatId, { include: [{ model: User, attributes: ['id'] }] });
};

const isUserInChat = (users: User[], userId: number) => {
    return users.some(user => user.id === userId);
};

const removeUserConnection = (userId: number) => {
    const index = connectedUsers.findIndex(user => user.userId === userId);
    if (index !== -1) connectedUsers.splice(index, 1);
};

const updateUserStatus = async (userId: number, isOnline: boolean) => {
    try {
        const user = await User.findByPk(userId);
        if (!user) return;

        if (user.online !== isOnline) {
            user.online = isOnline;
            await user.save();
            console.log(`User ${user.username} status updated to ${isOnline ? 'online' : 'offline'}`);
        } else {
            console.log(`User ${user.username} is already ${isOnline ? 'online' : 'offline'}. No update needed.`);
        }
    } catch (error) {
        console.error('Error updating user status:', error);
    }
};
