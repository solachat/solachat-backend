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
        console.log(`Аватарка сгенерирована для публичного ключа: ${publicKey}`);
    }

    const user = await User.create({
        public_key: publicKey,
        username: username || null,
        avatar: avatarUrl,
        lastLogin: new Date(),
        lastOnline: new Date(),
    });

    console.log('Пользователь создан:', publicKey);

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
        await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 });

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
            console.log(`💾 Отдаем пользователя ${publicKey} из Redis`);
            return JSON.parse(cachedUser);
        }

        console.log(`🛢 Загружаем пользователя ${publicKey} из PostgreSQL`);

        const user = await User.findOne({ where: { public_key: publicKey } });
        if (!user) return null;

        await redisClient.set(cacheKey, JSON.stringify(user), { EX: 3600 });

        return user;
    } catch (error) {
        console.error('Error fetching user by publicKey:', error);
        throw new Error('Error fetching user by publicKey');
    }
};

export const updateUserStatus = async (userId: number, isOnline: boolean) => {
    try {
        console.log(`Attempting to update user status for userId: ${userId}, online: ${isOnline}`);

        const cacheKey = `user:${userId}`;
        let userData = await redisClient.get(cacheKey);

        let user;

        if (userData) {
            user = JSON.parse(userData);
            // Если статус уже актуальный — не обновляем
            if (user.online === isOnline) {
                console.log(`User ${user.username} status already up-to-date: ${user.online}`);
                return;
            }
        } else {
            user = await User.findByPk(userId);
            if (!user) {
                console.error(`User with ID ${userId} not found`);
                return;
            }

            user = {
                id: user.id,
                username: user.username,
                online: user.online,
                lastOnline: user.lastOnline,
            };
        }

        // Обновляем статус
        user.online = isOnline;
        if (!isOnline) {
            user.lastOnline = new Date();
        }

        // Сохраняем обновленные данные в Redis
        await redisClient.setEx(cacheKey, 300, JSON.stringify(user));

        // Обновляем статус в базе данных
        await User.update(
            { online: isOnline, lastOnline: user.lastOnline },
            { where: { id: userId } }
        );

        console.log(`User ${user.username} status updated successfully to ${user.online}`);
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
};
