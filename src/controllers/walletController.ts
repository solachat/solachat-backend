import { Request, Response } from 'express';
import { createNewWallet, getSolanaBalance } from '../services/solanaService';
import logger from '../utils/logger';

export const createWallet = async (req: Request, res: Response) => {
    try {
        const wallet = await createNewWallet();
        logger.info(`New wallet created: ${wallet.publicKey}`);
        res.json(wallet);
    } catch (error) {
        const err = error as Error;
        logger.error(`Error creating wallet: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const getBalance = async (req: Request<{ address: string }>, res: Response) => {
    const { address } = req.params;

    if (!address || address.trim() === '') {
        logger.warn('No address provided for balance fetch');
        return res.status(400).json({ error: 'No address provided' });
    }

    try {
        const balance = await getSolanaBalance(address);
        logger.info(`Fetched balance for address ${address}: ${balance} SOL`);
        res.json({ balance });
    } catch (error) {
        const err = error as Error;
        logger.error(`Error fetching balance for ${address}: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

