import { Request, Response } from 'express';
import { createUser, checkPassword } from '../services/userService';
import { createNewWallet } from '../services/solanaService';
import User from '../models/User';
import logger from '../utils/logger';

export const registerUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const wallet = createNewWallet();

        const user = await createUser(email, password, wallet.publicKey, wallet.secretKey);

        logger.info(`User registered: ${user.email}, Wallet: ${wallet.publicKey}`);

        res.status(201).json(user);
    } catch (error) {
        const err = error as Error;
        logger.error(`Registration failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            logger.warn(`Login attempt with invalid credentials: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await checkPassword(user.id, password);
        if (!isPasswordValid) {
            logger.warn(`Invalid password attempt for user: ${email}`);
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        logger.info(`User logged in: ${email}`);
        res.json({ message: 'Login successful', user });
    } catch (error) {
        const err = error as Error;
        logger.error(`Login failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};
