import { Request, Response } from 'express';
import {createUser, checkPassword, updateUserStatus} from '../services/userService';
import { UserRequest } from '../types/types';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {Op} from "sequelize";
import {getDestination} from "../config/uploadConfig";

const secret = process.env.JWT_SECRET || 'your_default_secret';

export const registerUser = async (req: Request, res: Response) => {
    const { email, password, username, realname, wallet: publicKey } = req.body;

    console.log('Registration Data:', { email, password, username, realname, publicKey });

    try {
        if (publicKey) {
            const existingUser = await User.findOne({ where: { public_key: publicKey } });
            if (existingUser) {
                return res.status(400).json({ message: 'Public key is already registered' });
            }
        }

        const user = await createUser(email, password, publicKey || null, username, realname, null);
        logger.info(`User registered: ${user.email}, Wallet: ${publicKey || 'No public key provided'}`);

        const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, secret, { expiresIn: '24h' });
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

        const token = jwt.sign({ id: user.id, email: user.email, username: user.username, avatar: user.avatar }, secret, { expiresIn: '24h' });
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

        // Деструктуризация для исключения пароля
        const { password, ...safeUserData } = user.dataValues;

        // Формирование responseData с необходимыми полями
        const responseData: any = {
            ...safeUserData, // Передаем все поля кроме password
            avatar: user.avatar,
            isOwner,
            aboutMe: user.aboutMe,
        };

        // Добавляем email только если пользователь разрешил или это владелец аккаунта
        if (user.shareEmail || isOwner) {
            responseData.email = user.email;
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
        await user.save();

        res.json({ message: 'Avatar updated successfully', avatar: user.avatar });
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
                    { realname: { [Op.iLike]: `%${searchTerm}%` } },
                ],
            },
            attributes: ['id', 'realname', 'username', 'avatar', 'online'],
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

