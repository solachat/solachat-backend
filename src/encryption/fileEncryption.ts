import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from('e03ed966249b166b574e5035fe1e22c6ee5ac44ec5bf250d85ff523ba073c93b', 'hex');

export const encryptFile = async (fileBuffer: Buffer): Promise<Buffer> => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const encryptedBuffer = Buffer.concat([
        iv,
        cipher.update(fileBuffer),
        cipher.final(),
        cipher.getAuthTag(),
    ]);
    return encryptedBuffer;
};

export const decryptFile = async (encryptedBuffer: Buffer): Promise<Buffer> => {
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(-16);
    const encryptedContent = encryptedBuffer.slice(16, -16);

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
    return decryptedBuffer;
};
