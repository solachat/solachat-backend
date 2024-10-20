import { connectedUsers, WebSocketUser } from '../websocket';
import Call from '../models/Call';

// Initiating an individual call
export const initiateCall = async (fromUserId: number, toUserId: number) => {
    const call = await Call.create({
        fromUserId,
        toUserId,
        isGroupCall: false,
        status: 'initiated',
    });
    return call;
};

export const answerCall = async (fromUserId: number, toUserId: number, callId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (!callerUser) {
        console.error(`Caller user with ID ${fromUserId} is not connected.`);
        return false;  // Возвращаем false, если вызывающий пользователь не найден
    }

    if (callerUser.ws.readyState !== WebSocket.OPEN) {
        console.error('Caller user WebSocket connection is not open');
        return false;
    }

    const message = JSON.stringify({
        type: 'callAccepted',
        toUserId,
        callId, // Добавляем callId в сообщение
    });
    callerUser.ws.send(message);

    await Call.update(
        { status: 'accepted' },
        { where: { id: callId, fromUserId, toUserId, status: 'initiated' } }
    );

    return true;
};


// Rejecting an individual call
export const rejectCall = async (fromUserId: number, toUserId: number) => {
    await Call.update(
        { status: 'rejected' },
        { where: { fromUserId, toUserId, status: 'initiated' } }
    );
};

// Initiating a group call
export const initiateGroupCall = async (fromUserId: number, participantUserIds: number[]) => {
    const call = await Call.create({
        fromUserId,
        toUserId: participantUserIds[0],
        isGroupCall: true,
        status: 'initiated',
    });

    return call;
};

// Answering a group call
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

// Rejecting a group call
export const rejectGroupCall = async (fromUserId: number, toUserId: number) => {
    await Call.update(
        { status: 'rejected' },
        { where: { fromUserId, toUserId, status: 'initiated' } }
    );
};
