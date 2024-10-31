import User from '../models/User';
import generateAvatar from "../utils/generatorAvatar";
import UserChats from "../models/UserChats";

export const createUser = async (
    publicKey: string | null,
    username: string,
    avatar: string | null = null
) => {
    let avatarUrl = avatar;
    if (!avatarUrl) {
        avatarUrl = await generateAvatar(username);
        console.log(`Аватарка сгенерирована для пользователя ${username}`);
    }

    const user = await User.create({
        public_key: publicKey || null,
        username,
        avatar: avatarUrl,
        lastLogin: new Date(),
    });

    console.log('Creating user with public key:', publicKey);
    return user;
};

export const getUserById = async (userId: number) => {
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return null;
        }
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

export const updateUserStatus = async (userId: number, isOnline: boolean) => {
    try {
        console.log(`Attempting to update user status for userId: ${userId}, online: ${isOnline}`);

        const user = await User.findByPk(userId);
        if (!user) {
            console.error(`User with ID ${userId} not found`);
            return;
        }

        console.log(`User ${user.username} found, current status: ${user.online}`);

        user.online = isOnline;
        if (!isOnline) {
            user.lastOnline = new Date();
        }

        await user.save();
        console.log(`User ${user.username} status updated successfully to ${user.online}`);
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
};

