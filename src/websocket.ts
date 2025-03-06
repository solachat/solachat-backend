import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { Socket } from 'net';
import { getUserById, updateUserStatus } from './services/userService';
import redisClient from './config/redisClient';

const secret = process.env.JWT_SECRET || 'your_default_secret';
export const connectedUsers: { ws: WebSocket, userId: number }[] = [];

export interface WebSocketUser {
    ws: WebSocket;
    userId: number;
}

// Расширяем WebSocket объект, добавляя isAlive
interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
}

const broadcastClients = (message: any, filterFn?: (user: WebSocketUser) => boolean) => {
    connectedUsers.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN && (!filterFn || filterFn(user))) {
            user.ws.send(JSON.stringify(message));
        }
    });
};

export let wss: WebSocket.Server;

export const initWebSocketServer = (server: any) => {
    wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request: any, socket: Socket, head: any) => {
        console.log('Upgrade request received:', request.url);

        wss.handleUpgrade(request, socket, head, (ws: ExtendedWebSocket) => {
            console.log('WebSocket connection established with:', request.url);
            wss.emit('connection', ws, request);
        });
    });

    wss.on('connection', async (ws: ExtendedWebSocket, req: any) => {
        const queryParams = new URLSearchParams(req.url?.split('?')[1]);
        const token = queryParams.get('token');
        console.log('Token received:', token);

        if (!token) {
            ws.close(4001, 'No token provided');
            return;
        }

        try {
            const decoded = jwt.verify(token, secret) as { id: number };
            const userId = decoded.id;

            let user = await redisClient.get(`user:${userId}`);
            if (!user) {
                user = JSON.stringify(await getUserById(userId));
                if (!user) {
                    ws.close(4002, 'User not found');
                    return;
                }
                await redisClient.setEx(`user:${userId}`, 300, user);
            }
            const parsedUser = JSON.parse(user);

            broadcastClients({ type: 'USER_CONNECTED', userId });

            console.log(`User ${parsedUser.username} connected with ID ${userId}`);
            connectedUsers.push({ ws, userId });

            // Обновляем статус в Redis
            await redisClient.set(`online:${userId}`, 'true');
            await updateUserStatus(userId, true);

            // 🔥 Добавляем isAlive для Ping/Pong
            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', (message: string) => {
                const parsedMessage = JSON.parse(message);
            });

            ws.on('close', () => {
                console.log(`User ${parsedUser.username} disconnected.`);
                removeUserConnection(userId);
            });

        } catch (error) {
            console.error('JWT verification error:', error);
            ws.close(4003, 'Invalid token');
        }
    });

    // 🔥 Ping/Pong проверка соединений каждые 30 секунд
    setInterval(() => {
        wss.clients.forEach((ws) => {
            const client = ws as ExtendedWebSocket;
            if (!client.isAlive) return client.terminate();
            client.isAlive = false;
            client.ping();
        });
    }, 30000);

    console.log('WebSocket server initialized successfully.');
};

const removeUserConnection = async (userId: number) => {
    const index = connectedUsers.findIndex(user => user.userId === userId);
    if (index !== -1) {
        const disconnectedUser = connectedUsers.splice(index, 1)[0];
        if (disconnectedUser && disconnectedUser.ws.readyState === WebSocket.OPEN) {
            disconnectedUser.ws.close();
        }
        console.log(`User with ID ${userId} removed from connected users`);

        try {
            await redisClient.del(`online:${userId}`);
            await updateUserStatus(userId, false);
            console.log(`User status updated to offline for userId: ${userId}`);

            broadcastClients({ type: 'USER_DISCONNECTED', userId });
        } catch (error) {
            console.error(`Failed to update user status to offline for userId: ${userId}`, error);
        }
    }
};

export default broadcastClients;
