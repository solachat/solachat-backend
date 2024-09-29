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

const handleMessage = async (userId: number, rawMessage: string) => {
    try {
        const { chatId, content } = JSON.parse(rawMessage);

        const chat = await Chat.findByPk(chatId, {
            include: [{ model: User, as: 'users', attributes: ['id', 'username', 'avatar'] }]
        });

        if (!chat) {
            console.error(`Chat with ID ${chatId} not found`);
            return;
        }

        const isUserInChat = chat.users && chat.users.some((user: User) => user.id === userId);
        if (!isUserInChat) {
            console.error(`User ${userId} is not a member of chat ${chatId}`);
            return;
        }

        const message = await createMessage(userId, chatId, content, 'ws', 'localhost');
        await broadcastMessage(chatId, message);
    } catch (error) {
        console.error(`Error handling message from user ${userId}:`, error);
    }
};

const broadcastMessage = async (chatId: number, message: Message) => {
    try {
        const sender = await User.findByPk(message.userId, {
            attributes: ['id', 'username', 'realname', 'avatar', 'online'],
        });

        if (!sender) {
            console.error('Sender not found');
            return;
        }

        const chat = await Chat.findByPk(chatId, {
            include: [{ model: User, attributes: ['id'] }]
        });

        if (!chat || !chat.users || !Array.isArray(chat.users)) {
            console.error(`Chat with ID ${chatId} not found or has no participants`);
            return;
        }

        const participantIds = chat.users.map(user => user.id);

        const payload = JSON.stringify({
            type: 'newMessage',
            message: {
                id: message.id,
                content: decryptMessage(JSON.parse(message.content)),
                createdAt: message.createdAt,
                userId: sender.id,
                user: {
                    id: sender.id,
                    username: sender.username,
                    avatar: sender.avatar,
                    realname: sender.realname,
                    online: sender.online,
                },
            }
        });

        await Promise.all(connectedUsers.map(({ ws, userId }) => {
            if (ws.readyState === WebSocket.OPEN && participantIds.includes(userId)) {
                return ws.send(payload);
            }
        }));
    } catch (error) {
        console.error('Error broadcasting message:', error);
    }
};


const removeUserConnection = (userId: number) => {
    const index = connectedUsers.findIndex((user) => user.userId === userId);
    if (index !== -1) {
        connectedUsers.splice(index, 1);
    }
};

const updateUserStatus = async (userId: number, isOnline: boolean) => {
    try {
        const user = await User.findByPk(userId);

        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return;
        }

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
