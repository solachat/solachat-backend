import { Request, Response } from 'express';
import { getTokenBalance, sendTokenTransaction } from '../services/solanaService';
import logger from '../utils/logger';

export const getTokenBalanceController = async (req: Request<{ walletAddress: string; tokenMintAddress: string }>, res: Response) => {
    const { walletAddress, tokenMintAddress } = req.params;
    const payerSecretKey = req.body.payerSecretKey;

    try {
        const balance = await getTokenBalance(walletAddress, tokenMintAddress, payerSecretKey);
        logger.info(`Fetched SPL Token balance for wallet ${walletAddress}, token: ${tokenMintAddress}: ${balance}`);
        res.json({ balance });
    } catch (error) {
        const err = error as Error;
        logger.error(`Error fetching SPL Token balance: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const sendTokenController = async (req: Request<{}, {}, { from: string; to: string; amount: number; tokenMintAddress: string }>, res: Response) => {
    const { from, to, amount, tokenMintAddress } = req.body;

    try {
        const result = await sendTokenTransaction(from, to, amount, tokenMintAddress);
        logger.info(`Sent ${amount} tokens from ${from} to ${to}, mint: ${tokenMintAddress}`);
        res.json({ result });
    } catch (error) {
        const err = error as Error;
        logger.error(`Error sending token transaction: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

