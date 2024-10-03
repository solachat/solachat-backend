import { Request, Response } from 'express';
import { initiateGroupCall, answerGroupCall, rejectGroupCall } from '../services/callService';

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
        const callAnswered = await answerGroupCall(fromUserId, groupId, toUserId);
        if (callAnswered) {
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
