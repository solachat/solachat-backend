import WebSocket from 'ws';
import {connectedUsers, WebSocketUser} from '../websocket/index'; // массив подключенных пользователей

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

// Ответ на приватный звонок
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

// Отклонение приватного звонка
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

// Инициация группового звонка
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

// Ответ на групповой звонок
export const answerGroupCall = async (fromUserId: number, groupId: number, toUserId: number) => {
    const callerUser = connectedUsers.find((user: WebSocketUser) => user.userId === fromUserId);

    if (callerUser && callerUser.ws.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            type: 'groupCallAccepted',
            toUserId,
            groupId,
        });
        callerUser.ws.send(message);

        // TODO: Уведомление другим участникам группы
        return true;
    } else {
        console.error('Caller user is not available for group call');
        return false;
    }
};

// Отклонение группового звонка
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
