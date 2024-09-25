import crypto from 'crypto';
import User from '../models/User';

const AES_SECRET_KEY = process.env.AES_SECRET_KEY || 'default_secret_key_32_bytes_long';

console.log('AES_SECRET_KEY:', AES_SECRET_KEY, 'Length:', AES_SECRET_KEY.length);

if (AES_SECRET_KEY.length !== 32) {
    throw new Error('Invalid AES key length. The key must be exactly 32 bytes long.');
}

const encryptPassword = (password: string): string => {
    const cipher = crypto.createCipheriv('aes-256-cbc', AES_SECRET_KEY, Buffer.alloc(16, 0));
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const decryptPassword = (encryptedPassword: string): string => {
    const decipher = crypto.createDecipheriv('aes-256-cbc', AES_SECRET_KEY, Buffer.alloc(16, 0));
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

export const createUser = async (
    email: string,
    password: string,
    publicKey: string | null,
    username: string,
    realname: string
) => {
    const encryptedPassword = encryptPassword(password);
    const user = await User.create({
        email,
        password: encryptedPassword,
        public_key: publicKey || null,
        username,
        realname,
        lastLogin: new Date(),
    });
    console.log('Creating user with public key:', publicKey);
    return user;
};

export const checkPassword = async (userId: number, password: string): Promise<boolean> => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const decryptedPassword = decryptPassword(user.password);
    return decryptedPassword === password;
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
