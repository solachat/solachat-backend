import User from '../models/User';
import generateAvatar from "../utils/generatorAvatar";
import { comparePassword, hashPassword } from '../encryption/bcryptEncryption';

const AES_SECRET_KEY = process.env.AES_SECRET_KEY || 'default_secret_key_32_bytes_long';

console.log('AES_SECRET_KEY:', AES_SECRET_KEY, 'Length:', AES_SECRET_KEY.length);

if (AES_SECRET_KEY.length !== 32) {
    throw new Error('Invalid AES key length. The key must be exactly 32 bytes long.');
}

export const createUser = async (
    email: string,
    password: string,
    publicKey: string | null,
    username: string,
    realname: string,
    avatar: string | null
) => {
    const hashedPassword = await hashPassword(password);

    let avatarUrl = avatar;
    if (!avatarUrl) {
        avatarUrl = await generateAvatar(username);
        console.log(`Аватарка сгенерирована для пользователя ${username}`);
    }

    const user = await User.create({
        email,
        password: hashedPassword,
        public_key: publicKey || null,
        username,
        realname,
        avatar: avatarUrl,
        lastLogin: new Date(),
    });

    console.log('Creating user with public key:', publicKey);
    return user;
};

export const checkPassword = async (userId: number, password: string): Promise<boolean> => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const isPasswordValid = await comparePassword(password, user.password);
    return isPasswordValid;
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

        await user.save();
        console.log(`User ${user.username} status updated successfully to ${user.online}`);
    } catch (error) {
        console.error('Error updating user status:', error);
        throw error;
    }
};
