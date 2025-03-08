import User from '../models/User';
import generateAvatar from "../utils/generatorAvatar";
import UserChats from "../models/UserChats";
import redisClient from '../config/redisClient';

export const createUser = async (
    publicKey: string,
    username: string | null,
    avatar: string | null = null
) => {
    let avatarUrl = avatar;

    if (!avatarUrl) {
        avatarUrl = await generateAvatar(publicKey);
    }

    const user = await User.create({
        public_key: publicKey,
        username: username || null,
        avatar: avatarUrl,
        lastLogin: new Date(),
        lastOnline: new Date(),
    });

    await redisClient.set(`user:${user.id}`, JSON.stringify(user), { EX: 3600 });

    return user;
};

export const getUserById = async (userId: number) => {
    try {
        const keys = await redisClient.keys('user:*');
        for (const key of keys) {
            const cachedUser = await redisClient.get(key);
            if (cachedUser) {
                const userData = JSON.parse(cachedUser);
                if (userData.id === userId) {
                    console.log(`💾 Отдаем пользователя ${userId} из Redis`);
                    return userData;
                }
            }
        }

        let user = await User.findByPk(userId);
        if (!user) return null;

        const cacheKey = `user:${user.public_key}`;
        await redisClient.set(cacheKey, JSON.stringify(user));

        return user;
    } catch (error) {
        console.error('Error fetching user by ID:', error);
        throw new Error('Error fetching user by ID');
    }
};

export const getUserChatRole = async (chatId: number, userId: number) => {
    try {
        return await UserChats.findOne({
            where: { chatId, userId },
            attributes: ['role'],
        });
    } catch (error) {
        console.error(`Ошибка при получении роли пользователя ${userId} в чате ${chatId}:`, error);
        throw new Error('Ошибка при получении роли пользователя в чате');
    }
};

export const getUserByPublicKey = async (publicKey: string) => {
    try {
        const cacheKey = `user:${publicKey}`;

        const cachedUser = await redisClient.get(cacheKey);
        if (cachedUser) {
            return JSON.parse(cachedUser);
        }

        const user = await User.findOne({ where: { public_key: publicKey } });
        if (!user) return null;

        await redisClient.set(cacheKey, JSON.stringify(user));

        return user;
    } catch (error) {
        console.error('Error fetching user by publicKey:', error);
        throw new Error('Error fetching user by publicKey');
    }
};

export const updateUserStatus = async (publicKey: string, isOnline: boolean) => {
    try {
        console.log(`Updating user status in Redis -> publicKey: ${publicKey}, online: ${isOnline}`);

        const cacheKey = `user:${publicKey}`;
        let userData = await redisClient.get(cacheKey);
        let user;

        if (userData) {
            user = JSON.parse(userData);
            user.online = isOnline;

            if (!isOnline) {
                user.lastOnline = new Date();
            }

            await redisClient.setEx(cacheKey, 300, JSON.stringify(user));
            console.log(`✅ Redis updated -> user:${publicKey} | online: ${user.online}`);
        } else {
            console.error(`User with publicKey ${publicKey} not found in Redis`);
        }
    } catch (error) {
        console.error('Error updating user status:', error);
    }
};



