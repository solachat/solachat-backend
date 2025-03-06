import { Request, Response } from 'express';
import {createUser, getUserById, getUserByPublicKey, updateUserStatus} from '../services/userService';
import { UserRequest } from '../types/types';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Op } from "sequelize";
import {ensureDirectoryExists, getDestination} from "../config/uploadConfig";
import { getSolanaBalance, getTokenBalance } from "../services/solanaService";
import nacl from 'tweetnacl';
import base58 from 'bs58';
import { authenticator } from 'otplib';
import { ethers } from 'ethers';
import { isSolanaWallet, isEthereumWallet } from '../utils/walletUtils';
import {getEthereumBalance} from "../services/ethereumService";
import { v4 as uuidv4 } from 'uuid';
import redisClient from "../config/redisClient";

const secret = process.env.JWT_SECRET || 'your_default_secret';

export const registerUser = async (req: Request, res: Response) => {
    const { wallet: publicKey, message, signature } = req.body;

    console.log('Registration Data:', { publicKey, message });
    if (signature) {
        console.log('Signature received:', signature, 'Length:', signature.length);
    }

    try {
        if (!publicKey || !message || !signature) {
            res.status(400).json({ message: 'Public key, message, and signature are required' });
        }

        if (typeof publicKey !== 'string' || typeof message !== 'string' || typeof signature !== 'string') {
            res.status(400).json({ message: 'Invalid data format for public key, message, or signature' });
        }

        const existingUser = await User.findOne({ where: { public_key: publicKey } });
        if (existingUser) {
            res.status(400).json({ message: 'Public key is already registered' });
        }

        let isValidSignature = false;
        if (isSolanaWallet(publicKey)) {
            console.log('Validating Solana wallet...');
            const decodedSignature = new Uint8Array(Buffer.from(signature, 'base64'));
            const decodedPublicKey = base58.decode(publicKey);

            isValidSignature = nacl.sign.detached.verify(
                new TextEncoder().encode(message),
                decodedSignature,
                decodedPublicKey
            );
        } else if (isEthereumWallet(publicKey)) {
            console.log('Validating Ethereum wallet...');
            const messageHash = ethers.utils.hashMessage(message);
            const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);

            isValidSignature = recoveredAddress.toLowerCase() === publicKey.toLowerCase();
        } else {
            res.status(400).json({ message: 'Unsupported wallet format' });
        }

        if (!isValidSignature) {
            res.status(400).json({ message: 'Invalid signature' });
        }

        const user = await createUser(publicKey, null);

        console.info(`User successfully registered: Wallet: ${publicKey}`);

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key, avatar: user.avatar },
            process.env.JWT_SECRET || 'your_default_secret',
            { expiresIn: '48h' }
        );

        console.log('Generated Token:', token);

        res.status(201).json({ token, user });
    } catch (error) {
        console.error(`Registration failed: ${(error as Error).message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const loginUser = async (req: Request, res: Response) => {
    const { walletAddress, message, signature, totpCode } = req.body;

    console.log('Login Data:', { walletAddress, message, totpCode });

    try {
        if (totpCode) {
            const user = await User.findOne({ where: { totpSecret: { [Op.ne]: null } } });
            if (!user) {
                return res.status(404).json({ message: 'User not found or TOTP not set' });
            }

            const isValid = authenticator.verify({ token: totpCode, secret: user.totpSecret || '' });
            console.log(`Verifying TOTP: ${totpCode} - Result: ${isValid}`);

            if (!isValid) {
                return res.status(400).json({ message: 'Invalid TOTP code' });
            }

            const token = jwt.sign(
                { id: user.id, publicKey: user.public_key, avatar: user.avatar },
                secret,
                { expiresIn: '48h' }
            );

            console.log('Token created with publicKey:', user.public_key);
            return res.json({ token, user: { publicKey: user.public_key, avatar: user.avatar } });
        }

        if (!walletAddress || !message || !signature) {
            return res.status(400).json({ message: 'Public key, message, and signature are required' });
        }

        const user = await User.findOne({ where: { public_key: walletAddress } });
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        let isValidSignature = false;

        if (isEthereumWallet(walletAddress)) {
            const messageHash = ethers.utils.hashMessage(message);

            try {
                const recoveredAddress = ethers.utils.recoverAddress(messageHash, signature);
                isValidSignature = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
            } catch (error) {
                console.error("Error in signature verification:", error);
                res.status(400).json({ message: 'Invalid signature format' });
            }
        } else if (isSolanaWallet(walletAddress)) {
            const decodedSignature = new Uint8Array(Buffer.from(signature, 'base64'));
            const decodedPublicKey = base58.decode(walletAddress);

            isValidSignature = nacl.sign.detached.verify(
                new TextEncoder().encode(message),
                decodedSignature,
                decodedPublicKey
            );
        } else {
            return res.status(400).json({ message: 'Unsupported wallet format' });
        }

        if (!isValidSignature) {
            return res.status(401).json({ message: 'Invalid signature' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key, avatar: user.avatar },
            secret,
            { expiresIn: '48h' }
        );

        console.log('Returning publicKey:', user.public_key);
        return res.json({ token, user: { publicKey: user.public_key, avatar: user.avatar } });
    } catch (error) {
        const err = error as Error;
        console.error(`Login failed: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
};

export const getProfile = async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    const publicKey = req.query.public_key as string;

    if (!publicKey) {
        return res.status(400).json({ message: 'Invalid request: missing public_key' });
    }

    try {
        const decoded = jwt.verify(token, secret) as { publicKey: string };

        const user = await getUserByPublicKey(publicKey);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isOwner = decoded.publicKey === user.public_key;
        const { password, ...safeUserData } = user;

        const responseData: any = {
            ...safeUserData,
            avatar: user.avatar,
            isOwner,
            aboutMe: user.aboutMe,
            public_key: user.sharePublicKey || isOwner ? user.public_key : undefined,
            balance: 0,
            tokenBalance: 0,
            ethereumBalance: 0,
        };


        res.json(responseData);
    } catch (error) {
        console.error(`Profile fetch failed: ${error}`);
        res.status(401).json({ message: 'Invalid token' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    const { public_key } = req.params;
    const { newUsername, sharePublicKey, aboutMe } = req.body;

    try {
        const user = await User.findOne({ where: { public_key } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (newUsername && newUsername !== user.username) {
            const existingUser = await User.findOne({ where: { username: newUsername } });
            if (existingUser) {
                return res.status(409).json({ error: 'Username is already taken' });
            }
        }

        user.username = newUsername || user.username;
        user.sharePublicKey = sharePublicKey !== undefined ? sharePublicKey : user.sharePublicKey;
        user.aboutMe = aboutMe !== undefined ? aboutMe : user.aboutMe;

        await user.save();

        const userCacheKey = `user:${user.public_key}`;
        await redisClient.del(userCacheKey);

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key },
            secret,
            { expiresIn: '48h' }
        );

        res.json({ user: user.toJSON(), token });
    } catch (error) {
        const err = error as Error;
        logger.error(`Profile update failed: ${err.message}`);
        res.status(500).json({ error: 'Error updating profile', message: err.message });
    }
};

export const updateAvatar = async (req: UserRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User is not authenticated' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const user = await User.findOne({ where: { id: req.user.id } });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const fileExtension = path.extname(req.file.originalname).slice(1);
        const destinationPath = getDestination(fileExtension);

        ensureDirectoryExists(destinationPath);

        const uploadedFilePath = path.join(destinationPath, req.file.filename);
        const fileBuffer = fs.readFileSync(uploadedFilePath);
        const uploadedFileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        const existingUserWithSameHash = await User.findOne({ where: { avatarHash: uploadedFileHash } });

        if (existingUserWithSameHash) {
            fs.unlink(uploadedFilePath, (err) => {
                if (err) {
                    logger.error(`Error removing duplicate file: ${err.message}`);
                }
            });

            const token = jwt.sign(
                { id: user.id, publicKey: user.public_key, avatar: user.avatar },
                secret,
                { expiresIn: '48h' }
            );

            return res.json({
                message: 'Avatar is the same as an existing one, no changes made',
                avatar: existingUserWithSameHash.avatar,
                token
            });
        }

        const avatarUrl = `${req.protocol}://${req.get('host')}/${destinationPath}/${req.file.filename}`;
        user.avatar = avatarUrl;
        user.avatarHash = uploadedFileHash;
        await user.save();

        const userCacheKey = `user:${user.public_key}`;
        const cachedUser = await redisClient.get(userCacheKey);
        if (cachedUser) {
            const updatedUser = JSON.parse(cachedUser);
            updatedUser.avatar = user.avatar;
            await redisClient.setEx(userCacheKey, 3600, JSON.stringify(updatedUser));
        }

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key, avatar: user.avatar },
            secret,
            { expiresIn: '48h' }
        );

        res.json({ message: 'Avatar updated successfully', avatar: user.avatar, token });
    } catch (error) {
        const err = error as Error;
        logger.error(`Failed to update avatar: ${err.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};


export const getUserAvatars = async (req: Request, res: Response) => {
    try {
        const userId = req.params.userId;
        const user = await User.findOne({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const avatarsDir = path.join(__dirname, '../uploads/avatars');

        const allAvatars = fs.readdirSync(avatarsDir);

        const userAvatars = allAvatars.filter((filename) => {
            return filename.startsWith(user.username);
        });

        const avatarUrls = userAvatars.map((filename) => {
            return `${req.protocol}://${req.get('host')}/uploads/avatars/${filename}`;
        });

        res.json({ avatars: avatarUrls });
    } catch (error) {
        console.error('Error fetching user avatars:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const searchUser = async (req: Request, res: Response) => {
    const { searchTerm } = req.query;

    try {
        const users = await User.findAll({
            where: {
                [Op.or]: [
                    { username: { [Op.iLike]: `%${searchTerm}%` } },
                    { public_key: { [Op.iLike]: `%${searchTerm}%` } },
                ],
            },
            attributes: ['id', 'username', 'public_key', 'avatar', 'online', "verified"],
        });

        res.status(200).json(users);
    } catch (error) {
        logger.error(`Error searching users: ${(error as Error).message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const updateUserStatusController = async (req: Request, res: Response) => {
    const { userId, isOnline } = req.body;

    if (!userId || typeof isOnline === 'undefined') {
        return res.status(400).json({ message: 'userId and isOnline are required' });
    }

    try {
        await updateUserStatus(userId, isOnline);
        return res.status(200).json({ message: 'User status updated successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Error updating user status', error });
    }
};

export const attachPublicKey = async (req: Request, res: Response) => {
    const { publicKey } = req.body;
    const userId = req.user?.id;

    if (!publicKey) {
        return res.status(400).json({ message: 'Public key is required' });
    }

    try {
        console.log(`Received public key: ${publicKey} for user ID: ${userId}`);
        const existingUser = await User.findOne({ where: { public_key: publicKey } });
        if (existingUser) {
            console.log(`Public key ${publicKey} already in use by another user`);
            return res.status(400).json({ message: 'Public key is already in use' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            console.log(`User with ID ${userId} not found`);
            return res.status(404).json({ message: 'User not found' });
        }

        user.public_key = publicKey;
        await user.save();

        logger.info(`Public key ${publicKey} successfully attached to user ${user.username}`);
        res.status(200).json({ message: 'Public key attached successfully', publicKey });
    } catch (error) {
        const err = error as Error;
        logger.error(`Failed to attach public key: ${err.message}`);
        res.status(500).json({ message: 'Internal server error' });
    }
};

export const setupTotp = async (req: Request, res: Response) => {
    const userId = req.user?.id;

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Using secret:', user.totpSecret);

        const secret = authenticator.generateSecret();
        user.totpSecret = secret;
        await user.save();

        const otpauthUrl = authenticator.keyuri(user.username, 'SolaCoin', secret);
        res.json({ otpauthUrl, secret });
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ message: 'Failed to setup TOTP', error: err.message });
    }
}

export const verifyTotp = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { totpCode } = req.body;

    try {
        const user = await User.findByPk(userId);
        if (!user || !user.totpSecret) {
            return res.status(404).json({ success: false, message: 'User or TOTP setup not found' });
        }

        const isValid = authenticator.verify({ token: totpCode, secret: user.totpSecret });

        if (isValid) {
            return res.status(200).json({ success: true, message: 'TOTP verified successfully' });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid TOTP code' });
        }
    } catch (error) {
        const err = error as Error;
        res.status(500).json({ success: false, message: 'Error verifying TOTP', error: err.message });
    }
};

