import WebSocket from 'ws';
import {connectedUsers, WebSocketUser} from '../websocket/index';

export const initiateCall = async (fromUserId: number, toUserId: number) => {
    const targetUser = connectedUsers.find((user: WebSocketUser) => user.userId === toUserId);

    if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'callOffer',
            fromUserId,
        });
        targetUser.ws.send(message);
        return true;
    } else {
        console.error('Target user is not available for call');
        return false;
    }
};

export const answerCall = async (fromUserId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'callAccepted',
            toUserId,
        });
        callerUser.ws.send(message);
        return true;
    } else {
        console.error('Caller user is not available for call');
        return false;
    }
};

export const rejectCall = async (fromUserId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'callRejected',
            toUserId,
        });
        callerUser.ws.send(message);
    }
};

export const initiateGroupCall = async (fromUserId: number, participantUserIds: number[]) => {
    participantUserIds.forEach(toUserId => {
        const targetUser = connectedUsers.find((user: WebSocketUser) => user.userId === toUserId);

        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
                type: 'groupCallOffer',
                fromUserId,
            });
            targetUser.ws.send(message);
        } else {
            console.error(`User ${toUserId} is not available for group call`);
        }
    });

    return true;
};

export const answerGroupCall = async (fromUserId: number, groupId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'groupCallAccepted',
            toUserId,
            groupId,
        });
        callerUser.ws.send(message);

        return true;
    } else {
        console.error('Caller user is not available for group call');
        return false;
    }
};

export const rejectGroupCall = async (fromUserId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'groupCallRejected',
            toUserId,
        });
        callerUser.ws.send(message);
    }
};
