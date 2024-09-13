import { Request, Response } from 'express';
import {getTokenBalance, getTokenTransactions, sendTokenTransaction} from '../services/solanaService';
import logger from '../utils/logger';

export const getTokenBalanceController = async (req: Request<{ walletAddress: string }>, res: Response) => {
    const { walletAddress } = req.params;
    try {
        const balance = await getTokenBalance(walletAddress);
        logger.info(`Fetched SPL Token balance for wallet ${walletAddress}: ${balance}`);
        res.json({ balance });
    } catch (error) {
        const err = error as Error;
        logger.error(`Error fetching SPL Token balance for ${walletAddress}: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: err.message });
    }
};


export const sendTokenController = async (req: Request<{}, {}, { from: string; to: string; amount: number }>, res: Response) => {
    const { from, to, amount } = req.body;

    try {
        const result = await sendTokenTransaction(from, to, amount);
        logger.info(`Sent ${amount} tokens from ${from} to ${to}`);
        res.json({ result });
    } catch (error) {
        const err = error as Error;
        logger.error(`Error sending token transaction: ${err.message}`, { stack: err.stack });
        res.status(500).json({ error: err.message });
    }
};

export const getTokenTransactionsController = async (req: Request<{ mintAddress?: string }>, res: Response) => {
    const mintAddress = req.params.mintAddress || process.env.TOKEN_MINT_ADDRESS;

    if (!mintAddress) {
        return res.status(400).json({ error: 'Mint address is required' });
    }

    try {
        const transactions = await getTokenTransactions(mintAddress);
        logger.info(`Fetched ${transactions.length} transactions for mint address: ${mintAddress}`);
        res.json(transactions);
    } catch (error) {
        const err = error as Error;
        logger.error(`Error fetching transactions for mint address ${mintAddress}: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};
