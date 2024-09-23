import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { getUserById } from '../services/userService';
import Message from '../models/Message';
import { createMessage } from '../services/messageService';
import Chat from '../models/Chat';
import { decrypt } from '../utils/encryptionUtils';

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

            // Вызываем функцию для обновления статуса пользователя на "online"
            await updateUserStatus(userId, true);
            console.log(`User ${user.username} is now online`);

            connectedUsers.push({ ws, userId });

            ws.on('message', async (message: string) => {
                const parsedMessage = JSON.parse(message);

                if (parsedMessage.type === 'heartbeat') {
                    console.log(`Received heartbeat from user ${user.username}`);
                    await updateUserStatus(userId, true); // Обновляем статус на "online"
                } else {
                    handleMessage(userId, parsedMessage);
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

        // Шифруем сообщение перед сохранением
        const message = await createMessage(userId, chatId, content, 'ws', 'localhost'); // или другие значения для protocol и host

        // Вещаем зашифрованное сообщение
        broadcastMessage(chatId, message);
    } catch (error) {
        console.error(`Error handling message from user ${userId}:`, error);
    }
};

const broadcastMessage = async (chatId: number, message: Message) => {
    try {
        // Загружаем данные об отправителе
        const sender = await User.findByPk(message.userId, {
            attributes: ['id', 'username', 'realname', 'avatar', 'online'],
        });

        if (!sender) {
            console.error('Sender not found');
            return;
        }

        // Получаем участников чата
        const chat = await Chat.findByPk(chatId, {
            include: [
                {
                    model: User,
                    attributes: ['id']
                }
            ]
        });

        if (!chat || !chat.users || !Array.isArray(chat.users)) {
            console.error(`Chat with ID ${chatId} not found or has no participants`);
            return;
        }

        // Получаем IDs участников чата
        const participantIds = chat.users.map(user => user.id);

        // Отправляем сообщение с полной информацией о пользователе всем участникам чата
        connectedUsers.forEach(({ ws, userId }) => {
            if (ws.readyState === WebSocket.OPEN && participantIds.includes(userId)) {
                ws.send(JSON.stringify({
                    type: 'newMessage',
                    message: {
                        id: message.id,
                        content: decrypt(JSON.parse(message.content)),
                        createdAt: message.createdAt,
                        sender: {
                            id: sender.id,
                            username: sender.username,
                            realname: sender.realname,
                            avatar: sender.avatar,
                            online: sender.online,
                        }
                    }
                }));
            }
        });
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

        user.online = isOnline;
        await user.save();  // Сохраняем обновленный статус
        console.log(`User ${user.username} status updated to ${isOnline ? 'online' : 'offline'}`);
    } catch (error) {
        console.error('Error updating user status:', error);
    }
};
