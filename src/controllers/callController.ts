import { Request, Response } from 'express';
import { initiateCall, answerCall, rejectCall, initiateGroupCall, answerGroupCall, rejectGroupCall } from '../services/callService';

export const initiateCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, toUserId } = req.body;

    try {
        const callInitiated = await initiateCall(fromUserId, toUserId);
        if (callInitiated) {
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
    const { fromUserId, toUserId } = req.body;

    try {
        const callAnswered = await answerCall(fromUserId, toUserId);
        if (callAnswered) {
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
        res.status(200).json({ message: 'Call rejected' });
    } catch (error) {
        console.error('Error rejecting call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const initiateGroupCallHandler = async (req: Request, res: Response) => {
    const { fromUserId, participantUserIds } = req.body;

    try {
        const callInitiated = await initiateGroupCall(fromUserId, participantUserIds);
        if (callInitiated) {
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
        res.status(200).json({ message: 'Group call rejected' });
    } catch (error) {
        console.error('Error rejecting group call:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
