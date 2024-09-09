import crypto from 'crypto';
import User from '../models/User';

const AES_SECRET_KEY = process.env.AES_SECRET_KEY || 'default_secret_key_32_bytes_long';

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

export const createUser = async (email: string, password: string, publicKey: string, secretKey: string) => {
    const encryptedPassword = encryptPassword(password);
    const user = await User.create({
        email,
        password: encryptedPassword,
        public_key: publicKey,
        secret_key: secretKey,
    });
    return user;
};

export const checkPassword = async (userId: number, password: string): Promise<boolean> => {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('User not found');

    const decryptedPassword = decryptPassword(user.password);
    return decryptedPassword === password;
};
