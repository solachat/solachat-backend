import { Request, Response } from 'express';
import { createUser, checkPassword } from '../services/userService';
import { createNewWallet } from '../services/solanaService';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || 'your_default_secret';

export const registerUser = async (req: Request, res: Response) => {
    const { email, password, username, realname, avatar, rating } = req.body;

    console.log('Registration Data:', { email, password, username, realname });

    try {
        const wallet = createNewWallet();

        const user = await createUser(email, password, wallet.publicKey, wallet.secretKey, username, realname, avatar, rating);

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
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isPasswordValid = await checkPassword(user.id, password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '1h' });

        return res.json({ token, user: { username: user.username, email: user.email } });
    } catch (error) {
        if (error instanceof Error) {
            return res.status(500).json({ error: error.message });
        } else {
            return res.status(500).json({ error: 'Unknown error' });
        }
    }
};

export const getProfile = async (req: Request, res: Response) => {
    const { username } = req.query;

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    const { username } = req.params;
    const { shareEmail, shareCountry, shareTimezone } = req.body;

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.shareEmail = shareEmail;
        user.shareCountry = shareCountry;
        user.shareTimezone = shareTimezone;

        await user.save();

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error updating profile' });
    }
};
