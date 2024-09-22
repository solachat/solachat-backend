import crypto from 'crypto';

export const generateRSAKeys = () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
    });

    return { publicKey, privateKey };
};

export const encryptWithPublicKey = (publicKey: string, message: string) => {
    const buffer = Buffer.from(message);
    return crypto.publicEncrypt(publicKey, buffer).toString('base64');
};

export const decryptWithPrivateKey = (privateKey: string, encryptedMessage: string) => {
    const buffer = Buffer.from(encryptedMessage, 'base64');
    return crypto.privateDecrypt(privateKey, buffer).toString('utf8');
};
