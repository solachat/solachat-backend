import WebSocket from 'ws';
import { connectedUsers, WebSocketUser } from '../websocket/index';
import Call from '../models/Call';

export const initiateCall = async (fromUserId: number, toUserId: number) => {
    const call = await Call.create({
        fromUserId,
        toUserId,
        isGroupCall: false,
        status: 'initiated',
    });

    const targetUser = connectedUsers.find((user: WebSocketUser) => user.userId === toUserId);
    if (!targetUser) {
        console.error(`User ${toUserId} is not found in connectedUsers.`);
        return false;
    }

    if (targetUser.ws.readyState !== WebSocket.OPEN) {
        console.error(`WebSocket for user ${toUserId} is not open. State: ${targetUser.ws.readyState}`);
        return false;
    }

    const message = JSON.stringify({
        type: 'callOffer',
        fromUserId,
        callId: call.id,
    });
    targetUser.ws.send(message);
    console.log(`Call offer sent to user ${toUserId}`);

    return true;
};

export const answerCall = async (fromUserId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'callAccepted',
            toUserId,
        });
        callerUser.ws.send(message);

        await Call.update(
            { status: 'accepted' },
            { where: { fromUserId, toUserId, status: 'initiated' } }
        );

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

        await Call.update(
            { status: 'rejected' },
            { where: { fromUserId, toUserId, status: 'initiated' } }
        );
    }
};

export const initiateGroupCall = async (fromUserId: number, participantUserIds: number[]) => {
    const call = await Call.create({
        fromUserId,
        toUserId: participantUserIds[0],
        isGroupCall: true,
        status: 'initiated',
    });

    participantUserIds.forEach(toUserId => {
        const targetUser = connectedUsers.find((user: WebSocketUser) => user.userId === toUserId);

        if (targetUser && targetUser.ws.readyState === WebSocket.OPEN) {
            const message = JSON.stringify({
                type: 'groupCallOffer',
                fromUserId,
                callId: call.id,
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

        await Call.update(
            { status: 'accepted' },
            { where: { fromUserId, toUserId, status: 'initiated' } }
        );

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

        await Call.update(
            { status: 'rejected' },
            { where: { fromUserId, toUserId, status: 'initiated' } }
        );
    }
};
