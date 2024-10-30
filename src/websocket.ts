import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { Socket } from 'net';
import { getUserById } from '../../messenger/user-service/src/services/userService';
import { updateUserStatus } from './services/userService';

const secret = process.env.JWT_SECRET || 'your_default_secret';
export const connectedUsers: { ws: WebSocket, userId: number }[] = [];

export interface WebSocketUser {
    ws: WebSocket;
    userId: number;
}

const broadcastClients = (message: any) => {
    connectedUsers.forEach(user => {
        if (user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify(message));
        }
    });
};


export let wss: WebSocket.Server;

export const initWebSocketServer = (server: any) => {
    wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request: any, socket: Socket, head: any) => {
        console.log('Upgrade request received:', request.url);

        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
            console.log('WebSocket connection established with:', request.url);
            wss.emit('connection', ws, request);
        });
    });

    wss.on('connection', async (ws: WebSocket, req: any) => {
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

            const user = await getUserById(userId);
            if (!user) {
                ws.close(4002, 'User not found');
                return;
            }

            broadcastClients({ type: 'USER_CONNECTED', userId });

            console.log(`User ${user.username} connected with ID ${userId}`);
            connectedUsers.push({ ws, userId });

            ws.on('message', (message: string) => {
                const parsedMessage = JSON.parse(message);
            });

            ws.on('close', () => {
                console.log(`User ${user.username} disconnected.`);
                removeUserConnection(userId);
            });

        } catch (error) {
            console.error('JWT verification error:', error);
            ws.close(4003, 'Invalid token');
        }
    });

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
            await updateUserStatus(userId, false);
            console.log(`User status updated to offline for userId: ${userId}`);

            broadcastClients({ type: 'USER_DISCONNECTED', userId });
        } catch (error) {
            console.error(`Failed to update user status to offline for userId: ${userId}`, error);
        }
    }
};
