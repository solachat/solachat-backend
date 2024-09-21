import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getUserById } from '../services/userService';
import Message from '../models/Message';
import { createMessage } from '../services/messageService';
import Chat from '../models/Chat';

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
        console.log('Received token:', token); // Логируем токен для проверки

        if (!token) {
            console.error('No token provided, closing connection.');
            ws.close(4001, 'No token provided');
            return;
        }

        try {
            const decoded = jwt.verify(token, secret) as { id: number }; // Расшифровываем JWT
            console.log('Токен успешно декодирован:', decoded);
            const userId = decoded.id;

            const user = await getUserById(userId);
            if (!user) {
                console.error('User not found, closing connection.');
                ws.close(4002, 'User not found');
                return;
            }

            console.log('Пользователь найден:', user.username);

            connectedUsers.push({ ws, userId });
            console.log(`User ${user.username} connected`);

            ws.on('message', (message: string) => {
                handleMessage(userId, message);
            });

            ws.on('close', (code, reason) => {
                console.log(`User ${user.username} disconnected with code ${code}, reason: ${reason}`);
                removeUserConnection(userId);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for user ${user.username}:`, error);
            });

        } catch (error) {
            console.error('Ошибка при обработке WebSocket соединения:', error);
            ws.close(4003, 'Invalid token');
        }
    });
};

const handleMessage = async (userId: number, rawMessage: string) => {
    try {
        const parsedMessage = JSON.parse(rawMessage);
        const { chatId, content } = parsedMessage;

        const chat = await Chat.findByPk(chatId, {
            include: [{
                model: User,
                as: 'users',
                attributes: ['id', 'username']
            }]
        });

        if (!chat) {
            console.error(`Chat with ID ${chatId} not found`);
            return;
        }

        const isUserInChat = chat.users?.some((user: User) => user.id === userId);
        if (!isUserInChat) {
            console.error(`User ${userId} is not a member of chat ${chatId}`);
            return;
        }

        const message = await createMessage(userId, chatId, content);
        broadcastMessage(chatId, message);
    } catch (error) {
        console.error(`Error handling message from user ${userId}:`, error);
    }
};

const broadcastMessage = (chatId: number, message: Message) => {
    connectedUsers.forEach(({ ws }) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'NEW_MESSAGE',
                chatId,
                message: {
                    id: message.id,
                    content: message.content,
                    createdAt: message.createdAt,
                    senderId: message.userId
                }
            }));
        }
    });
};

const removeUserConnection = (userId: number) => {
    const index = connectedUsers.findIndex((user) => user.userId === userId);
    if (index !== -1) {
        connectedUsers.splice(index, 1);
    }
};
