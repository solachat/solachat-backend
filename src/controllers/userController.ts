import { Request, Response } from 'express';
import { createUser, checkPassword } from '../services/userService';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET || 'your_default_secret';

export const registerUser = async (req: Request, res: Response) => {
    const { email, password, username, realname, wallet: publicKey } = req.body;

    if (!publicKey) {
        return res.status(400).json({ message: 'Public key is required' });
    }

    console.log('Registration Data:', { email, password, username, realname, publicKey });

    try {
        const user = await createUser(email, password, publicKey, username, realname);
        logger.info(`User registered: ${user.email}, Wallet: ${publicKey}`);

        const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, secret, { expiresIn: '1h' });
        res.status(201).json({ token, user });
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

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, secret, { expiresIn: '1h' });
        return res.json({ token, user: { username: user.username, email: user.email, lastLogin: user.lastLogin } });
    } catch (error) {
        const err = error as Error;
        logger.error(`Login failed: ${err.message}`);
        return res.status(500).json({ error: err.message });
    }
};



export const getProfile = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, secret) as { username: string };
        const user = await User.findOne({ where: { username: req.query.username } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isOwner = decoded.username === user.username;
        res.json({ ...user.dataValues, isOwner, aboutMe: user.aboutMe });
    } catch (error) {
        const err = error as Error;
        logger.error(`Profile fetch failed: ${err.message}`);
        return res.status(401).json({ message: 'Invalid token' });
    }
};


export const updateProfile = async (req: Request, res: Response) => {
    const { username } = req.params;
    const { newUsername, realname, email, shareEmail, aboutMe } = req.body;

    try {
        const user = await User.findOne({ where: { username } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.username = newUsername || user.username;
        user.realname = realname || user.realname;
        user.email = email || user.email;
        user.shareEmail = shareEmail !== undefined ? shareEmail : user.shareEmail;
        user.aboutMe = aboutMe || user.aboutMe;

        await user.save();

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            secret,
            { expiresIn: '1h' }
        );

        res.json({ user: user.toJSON(), token });
    } catch (error) {
        const err = error as Error;
        logger.error(`Profile update failed: ${err.message}`);
        res.status(500).json({ error: 'Error updating profile' });
    }
};

export const phantomLogin = async (req: Request, res: Response) => {
    const { wallet } = req.body;

    if (!wallet) {
        return res.status(400).json({ message: 'Wallet address is required' });
    }

    try {
        const user = await User.findOne({ where: { public_key: wallet } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            secret,
            { expiresIn: '1h' }
        );

        return res.json({ token, user });
    } catch (error) {
        const err = error as Error;
        logger.error(`Phantom login failed: ${err.message}`);
        return res.status(500).json({ message: 'Internal server error' });
    }
};


