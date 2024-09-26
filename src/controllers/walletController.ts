import { Request, Response } from 'express';
import { getSolanaBalance } from '../services/solanaService';
import logger from '../utils/logger';

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

