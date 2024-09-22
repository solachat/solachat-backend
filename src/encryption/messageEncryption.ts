import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = process.env.MESSAGE_ENCRYPTION_KEY || crypto.randomBytes(32); 
const iv = crypto.randomBytes(12);

export const encryptMessage = (message: string) => {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
        tag: authTag.toString('hex'),
    };
};

export const decryptMessage = (encryptedMessage: { iv: string, content: string, tag: string }) => {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(encryptedMessage.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(encryptedMessage.tag, 'hex'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedMessage.content, 'hex')),
        decipher.final(),
    ]);

    return decrypted.toString();
};
