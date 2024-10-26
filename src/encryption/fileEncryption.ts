import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const key = Buffer.from('e03ed966249b166b574e5035fe1e22c6ee5ac44ec5bf250d85ff523ba073c93b', 'hex');

export const encryptFile = async (fileBuffer: Buffer, originalFileName: string): Promise<{ encryptedBuffer: Buffer, metadata: any }> => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const encryptedBuffer = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const metadata = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        originalFileName
    };

    return { encryptedBuffer, metadata };
};

export const decryptFile = async (encryptedBuffer: Buffer, metadata: any): Promise<Buffer> => {
    const iv = Buffer.from(metadata.iv, 'hex');
    const authTag = Buffer.from(metadata.authTag, 'hex');

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decryptedBuffer;
};
