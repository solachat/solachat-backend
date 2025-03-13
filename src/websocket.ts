import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { Socket } from 'net';
import { getUserByPublicKey, updateUserStatus } from './services/userService';
import redisClient from './config/redisClient';

const secret = process.env.JWT_SECRET || 'your_default_secret';
export const connectedUsers: { ws: WebSocket, publicKey: string }[] = [];

export interface WebSocketUser {
    ws: WebSocket;
    publicKey: string;
}

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
        wss.handleUpgrade(request, socket, head, (ws: ExtendedWebSocket) => {
            wss.emit('connection', ws, request);
        });
    });

    wss.on('connection', async (ws: ExtendedWebSocket, req: any) => {
        const queryParams = new URLSearchParams(req.url?.split('?')[1]);
        const token = queryParams.get('token');

        if (!token) {
            ws.close(4001, 'No token provided');
            return;
        }


        try {
            const decoded = jwt.verify(token, secret) as { publicKey: string };
            const publicKey = String(decoded.publicKey);

            let userData = await redisClient.get(`user:${publicKey}`);
            let user;

            if (userData) {
                user = JSON.parse(userData);
            } else {
                user = await getUserByPublicKey(publicKey);
                if (!user) {
                    ws.close(4002, 'User not found');
                    return;
                }
            }

            broadcastClients({ type: 'USER_CONNECTED', publicKey });
            user.online = true;
            await redisClient.setEx(`user:${publicKey}`, 300, JSON.stringify(user));
            await updateUserStatus(publicKey, true);

            connectedUsers.push({ ws, publicKey });


            console.log(`✅ User ${publicKey} connected`);

            ws.isAlive = true;
            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('close', () => {
                removeUserConnection(publicKey);
            });

        } catch (error) {
            ws.close(4003, 'Invalid token');
        }
    });

    setInterval(() => {
        wss.clients.forEach((ws) => {
            const client = ws as ExtendedWebSocket;
            if (!client.isAlive) return client.terminate();
            client.isAlive = false;
            client.ping();
        });
    }, 30000);
};

const removeUserConnection = async (publicKey: string) => {
    const index = connectedUsers.findIndex(user => user.publicKey === publicKey);
    if (index !== -1) {
        const disconnectedUser = connectedUsers.splice(index, 1)[0];
        if (disconnectedUser && disconnectedUser.ws.readyState === WebSocket.OPEN) {
            disconnectedUser.ws.close();
        }

        try {
            const lastOnline = new Date().toISOString();
            let userData = await redisClient.get(`user:${publicKey}`);
            let user;
            if (userData) {
                user = JSON.parse(userData);
            } else {
                user = { publicKey };
            }
            user.online = false;
            user.lastOnline = lastOnline;
            await redisClient.setEx(`user:${publicKey}`, 300, JSON.stringify(user));

            await updateUserStatus(publicKey, false);

            broadcastClients({ type: 'USER_DISCONNECTED', publicKey, lastOnline });
        } catch (error) {
            console.error(`Failed to update user status to offline for publicKey: ${publicKey}`, error);
        }
    }
};

