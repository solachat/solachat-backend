import { Request, Response } from 'express';
import {createUser, updateUserStatus} from '../services/userService';
import { UserRequest } from '../types/types';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {Op} from "sequelize";
import {getDestination} from "../config/uploadConfig";
import {getSolanaBalance, getTokenBalance} from "../services/solanaService";
import nacl from 'tweetnacl';
import base58 from 'bs58';
import { authenticator } from 'otplib';

const secret = process.env.JWT_SECRET || 'your_default_secret';

export const registerUser = async (req: Request, res: Response) => {
    const { username, wallet: publicKey, message, signature } = req.body;

    console.log('Registration Data:', { username, publicKey, message });

    try {
        if (!publicKey || !message || !signature) {
            return res.status(400).json({ message: 'Public key, message, and signature are required' });
        }

        const existingUser = await User.findOne({ where: { public_key: publicKey } });
        if (existingUser) {
            return res.status(400).json({ message: 'Public key is already registered' });
        }

        const existingUsername = await User.findOne({ where: { username } });
        if (existingUsername) {
            return res.status(400).json({ message: 'Username is already taken' });
        }

        const decodedSignature = Uint8Array.from(signature);
        const decodedPublicKey = base58.decode(publicKey);

        const isValidSignature = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            decodedSignature,
            decodedPublicKey
        );

        if (!isValidSignature) {
            return res.status(400).json({ message: 'Invalid signature' });
        }

        const user = await createUser(publicKey, username, null);
        console.info(`User registered: ${user.username}, Wallet: ${publicKey}`);

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key, username: user.username, avatar: user.avatar },
            secret,
            { expiresIn: '48h' }
        );

        res.status(201).json({ token, user });
    } catch (error) {
        console.error(`Registration failed: ${(error as Error).message}`);
        res.status(500).json({ error: (error as Error).message });
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
                { id: user.id, publicKey: user.public_key, username: user.username, avatar: user.avatar },
                secret,
                { expiresIn: '48h' }
            );

            return res.json({ token, user: { username: user.username, publicKey: user.public_key } });
        }

        if (!walletAddress || !message || !signature) {
            return res.status(400).json({ message: 'Public key, message, and signature are required' });
        }

        const user = await User.findOne({ where: { public_key: walletAddress } });
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        const decodedSignature = Uint8Array.from(signature);
        const decodedPublicKey = base58.decode(walletAddress);

        const isValidSignature = nacl.sign.detached.verify(
            new TextEncoder().encode(message),
            decodedSignature,
            decodedPublicKey
        );

        if (!isValidSignature) {
            return res.status(401).json({ message: 'Invalid signature' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user.id, publicKey: user.public_key, username: user.username, avatar: user.avatar },
            secret,
            { expiresIn: '48h' }
        );

        return res.json({ token, user: { username: user.username, publicKey: user.public_key, avatar: user.avatar } });
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

        const { password, ...safeUserData } = user.dataValues;

        const responseData: any = {
            ...safeUserData,
            avatar: user.avatar,
            isOwner,
            aboutMe: user.aboutMe,
        };

        if (user.sharePublicKey || isOwner) {
            responseData.public_key = user.public_key
        }

        if (user.public_key) {
            try {
                const solanaBalance = await getSolanaBalance(user.public_key);
                responseData.balance = solanaBalance;

                const tokenBalance = await getTokenBalance(user.public_key);
                responseData.tokenBalance = tokenBalance;
            } catch (balanceError) {
                const err = balanceError as Error;
                logger.error(`Error fetching balance for public_key ${user.public_key}: ${err.message}`);
                responseData.balanceError = 'Failed to fetch balances';
            }
        } else {
            responseData.balance = 0;
            responseData.tokenBalance = 0;
        }


        res.json(responseData);
    } catch (error) {
        const err = error as Error;
        logger.error(`Profile fetch failed: ${err.message}`);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    const { username } = req.params;
    const { newUsername, sharePublicKey, aboutMe } = req.body;

    try {
        const user = await User.findOne({ where: { username } });
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

        const token = jwt.sign(
            { id: user.id, username: user.username },
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

const hashFile = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
};

const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
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
        const uploadedFileHash = await hashFile(uploadedFilePath);

        const existingUserWithSameHash = await User.findOne({ where: { avatarHash: uploadedFileHash } });

        if (existingUserWithSameHash) {
            fs.unlink(uploadedFilePath, (err) => {
                if (err) {
                    logger.error(`Error removing duplicate file: ${err.message}`);
                }
            });
            return res.json({
                message: 'Avatar is the same as an existing one, no changes made',
                avatar: existingUserWithSameHash.avatar,
            });
        }

        const avatarUrl = `${req.protocol}://${req.get('host')}/${destinationPath}/${req.file.filename}`;
        user.avatar = avatarUrl;
        user.avatarHash = uploadedFileHash;

        const token = jwt.sign(
            { id: user.id, username: user.username, avatar: user.avatar },
            secret,
            { expiresIn: '48h' }
        );

        await user.save();

        logger.info('Successfully updated avatar!');
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
                ],
            },
            attributes: ['id', 'username', 'avatar', 'online', "verified"],
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

