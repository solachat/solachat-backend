import { Request, Response } from 'express';
import { initiateCall, answerCall, rejectCall, initiateGroupCall, answerGroupCall, rejectGroupCall } from '../services/callService';
import { wss } from '../app';
import { getUserById } from '../services/userService';


const broadcastToClients = (type: string, payload: object) => {
    const messagePayload = JSON.stringify({ type, ...payload });
    wss.clients.forEach((client: any) => {
        if (client.readyState === client.OPEN) {
            client.send(messagePayload);
        }
    });
};

export const initiateCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, toUserId } = req.body;

    try {
        const fromUser = await getUserById(fromUserId);
        const toUser = await getUserById(toUserId);

        if (!fromUser || !toUser) {
            return res.status(404).json({ message: 'One or both users not found' });
        }

        const call = await initiateCall(fromUserId, toUserId);
        if (call) {
            broadcastToClients('callOffer', {
                fromUserId,
                fromUsername: fromUser.username,
                fromAvatar: fromUser.avatar,
                toUserId,
                toUsername: toUser.username,
                toAvatar: toUser.avatar,
                callId: call.id,
                status: call.status,
            });
            res.status(200).json({ message: 'Call initiated' });
        } else {
            res.status(400).json({ message: 'Failed to initiate call' });
        }
    } catch (error) {
        console.error('Error initiating call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const answerCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, toUserId, callId } = req.body;

    try {
        const callAnswered = await answerCall(fromUserId, toUserId, callId);
        if (callAnswered) {
            broadcastToClients('callAccepted', {
                fromUserId,
                toUserId,
                callId,
                status: 'accepted',
            });
            res.status(200).json({ message: 'Call answered' });
        } else {
            res.status(400).json({ message: 'Failed to answer call' });
        }
    } catch (error) {
        console.error('Error answering call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const rejectCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, toUserId } = req.body;

    try {
        await rejectCall(fromUserId, toUserId);
        broadcastToClients('callRejected', {
            fromUserId,
            toUserId,
            status: 'rejected',
        });
        res.status(200).json({ message: 'Call rejected' });
    } catch (error) {
        console.error('Error rejecting call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const initiateGroupCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, participantUserIds } = req.body;

    try {
        const call = await initiateGroupCall(fromUserId, participantUserIds);
        if (call) {
            broadcastToClients('groupCallOffer', {
                fromUserId,
                participantUserIds,
                callId: call.id,
                status: 'initiated',
            });
            res.status(200).json({ message: 'Group call initiated' });
        } else {
            res.status(400).json({ message: 'Failed to initiate group call' });
        }
    } catch (error) {
        console.error('Error initiating group call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const answerGroupCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, groupId, toUserId } = req.body;

    try {
        const groupCallAnswered = await answerGroupCall(fromUserId, groupId, toUserId);
        if (groupCallAnswered) {
            broadcastToClients('groupCallAccepted', {
                fromUserId,
                toUserId,
                groupId,
                status: 'accepted',
            });
            res.status(200).json({ message: 'Group call answered' });
        } else {
            res.status(400).json({ message: 'Failed to answer group call' });
        }
    } catch (error) {
        console.error('Error answering group call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const rejectGroupCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, toUserId } = req.body;

    try {
        await rejectGroupCall(fromUserId, toUserId);
        broadcastToClients('groupCallRejected', {
            fromUserId,
            toUserId,
            status: 'rejected',
        });
        res.status(200).json({ message: 'Group call rejected' });
    } catch (error) {
        console.error('Error rejecting group call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
