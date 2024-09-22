import crypto from 'crypto';

const algorithm = 'aes-256-ctr';
const secretKey = process.env.AES_SECRET_KEY;

if (!secretKey || secretKey.length !== 32) {
    throw new Error('Invalid secret key length. Key must be 32 characters long.');
}

export const encrypt = (text: string) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
    };
};

export const decrypt = (hash: { iv: string, content: string }) => {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);

    return decrypted.toString();
};
