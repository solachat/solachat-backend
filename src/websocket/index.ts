import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { getUserById } from '../services/userService';
import { initiateCall, answerCall, rejectCall } from '../services/callService';

const secret = process.env.JWT_SECRET || 'your_default_secret';

export interface WebSocketUser {
    ws: WebSocket;
    userId: number;
}

export interface ActiveCall {
    callId: number;
    participants: WebSocketUser[];
}

export const connectedUsers: WebSocketUser[] = [];
export const activeCalls: ActiveCall[] = [];

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

            // Проверяем, не подключен ли пользователь уже
            const existingConnection = connectedUsers.find(u => u.userId === userId);
            if (existingConnection) {
                // Закрываем старое подключение, если оно существует
                existingConnection.ws.close(4004, 'User reconnected');
                connectedUsers.splice(connectedUsers.indexOf(existingConnection), 1);
            }

            console.log(`User ${user.username} with ID ${userId} connected.`);
            connectedUsers.push({ ws, userId });
            console.log(`User ${user.username} is now online`);

            ws.on('message', async (message: string) => {
                try {
                    const parsedMessage = JSON.parse(message);

                    if (parsedMessage.type === 'callOffer') {
                        const call = await initiateCall(userId, parsedMessage.toUserId);
                        addParticipantsToCall(call.id, [userId, parsedMessage.toUserId]);
                    } else if (parsedMessage.type === 'callAnswer') {
                        await answerCall(parsedMessage.fromUserId, userId, parsedMessage.callId);
                        addParticipantsToCall(parsedMessage.callId, [userId]);
                    } else if (parsedMessage.type === 'callReject') {
                        await rejectCall(parsedMessage.fromUserId, userId);
                        removeCall(parsedMessage.callId);
                    }
                } catch (err) {
                    console.error(`Error processing message from user ${user.username}:`, err);
                    ws.send(JSON.stringify({ type: 'error', message: 'Error processing your request' }));
                }
            });

            ws.on('close', (code, reason) => {
                console.log(`User ${user.username} disconnected with code ${code}, reason: ${reason}`);
                removeUserConnection(userId);
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

const getActiveCallByCallId = (callId: number): ActiveCall | null => {
    return activeCalls.find(call => call.callId === callId) || null;
};

const addParticipantsToCall = (callId: number, userIds: number[]) => {
    let activeCall = getActiveCallByCallId(callId);

    if (!activeCall) {
        activeCall = { callId, participants: [] };
        activeCalls.push(activeCall);
    }

    userIds.forEach(userId => {
        const wsUser = connectedUsers.find(user => user.userId === userId);
        if (wsUser && !activeCall.participants.some(p => p.userId === userId)) {
            activeCall.participants.push(wsUser);
        }
    });
};

const removeCall = (callId: number) => {
    const callIndex = activeCalls.findIndex(call => call.callId === callId);
    if (callIndex !== -1) {
        activeCalls.splice(callIndex, 1);
        console.log(`Call with ID ${callId} removed.`);
    }
};

const removeUserConnection = (userId: number) => {
    const index = connectedUsers.findIndex(user => user.userId === userId);
    if (index !== -1) {
        connectedUsers.splice(index, 1);
        console.log(`User with ID ${userId} removed from connected users`);
    }
};
