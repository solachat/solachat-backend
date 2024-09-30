import crypto from 'crypto';

const encryptionAlgorithm = 'aes-256-gcm';
const secretKey = process.env.AES_SECRET_KEY;
const hmacKey = process.env.HMAC_SECRET_KEY;

if (!secretKey || secretKey.length !== 32) {
    throw new Error('Invalid AES secret key length. Key must be 32 characters long.');
}

if (!hmacKey || hmacKey.length !== 32) {
    throw new Error('Invalid HMAC secret key length. Key must be 32 characters long.');
}


export const encryptMessage = (text: string): { iv: string; content: string; authTag: string; hmac: string } => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(encryptionAlgorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(iv);
    hmac.update(encrypted);
    const hmacDigest = hmac.digest('hex');

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
        authTag: authTag.toString('hex'),
        hmac: hmacDigest,
    };
};

export const decryptMessage = (hash: { iv: string; content: string; authTag: string; hmac: string }): string => {
    const iv = Buffer.from(hash.iv, 'hex');
    const encryptedContent = Buffer.from(hash.content, 'hex');
    const authTag = Buffer.from(hash.authTag, 'hex');

    const hmac = crypto.createHmac('sha256', hmacKey);
    hmac.update(iv);
    hmac.update(encryptedContent);
    const hmacDigest = hmac.digest('hex');

    if (hmacDigest !== hash.hmac) {
        throw new Error('Data integrity check failed: HMAC mismatch.');
    }

    const decipher = crypto.createDecipheriv(encryptionAlgorithm, secretKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);

    return decrypted.toString('utf8');
};

