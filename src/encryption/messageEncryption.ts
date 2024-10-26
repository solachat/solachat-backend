import crypto from 'crypto';

const encryptionAlgorithm = 'aes-256-gcm';
const secretKey = process.env.AES_SECRET_KEY;
const hmacKey = process.env.HMAC_SECRET_KEY;

if (!secretKey || secretKey.length !== 64) {
    throw new Error('Invalid AES secret key length. The key must be a 64-character hexadecimal string (32 bytes).');
}

if (!hmacKey || hmacKey.length !== 64) {
    throw new Error('Invalid HMAC secret key length. The key must be a 64-character hexadecimal string (32 bytes).');
}

const aesKeyBuffer = Buffer.from(secretKey, 'hex');
const hmacKeyBuffer = Buffer.from(hmacKey, 'hex');

export const encryptMessage = (text: string): { iv: string; content: string; authTag: string; hmac: string; salt: string } => {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(encryptionAlgorithm, aesKeyBuffer, iv);

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    const hmac = crypto.createHmac('sha512', hmacKeyBuffer);
    hmac.update(salt);
    hmac.update(iv);
    hmac.update(encrypted);
    const hmacDigest = hmac.digest('hex');

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex'),
        authTag: authTag.toString('hex'),
        hmac: hmacDigest,
        salt: salt.toString('hex'),
    };
};

export const decryptMessage = (hash: { iv: string; content: string; authTag: string; hmac: string; salt: string }): string => {
    const iv = Buffer.from(hash.iv, 'hex');
    const encryptedContent = Buffer.from(hash.content, 'hex');
    const authTag = Buffer.from(hash.authTag, 'hex');
    const salt = Buffer.from(hash.salt, 'hex');

    const hmac = crypto.createHmac('sha512', hmacKeyBuffer);
    hmac.update(salt);
    hmac.update(iv);
    hmac.update(encryptedContent);
    const hmacDigest = hmac.digest('hex');

    if (hmacDigest !== hash.hmac) {
        throw new Error('Data integrity check failed: HMAC mismatch.');
    }

    const decipher = crypto.createDecipheriv(encryptionAlgorithm, aesKeyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);

    return decrypted.toString('utf8');
};
