import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const algorithm = 'aes-256-gcm';
const key = process.env.FILE_ENCRYPTION_KEY || crypto.randomBytes(32);
const iv = crypto.randomBytes(12);

export const encryptFile = (filePath: string, outputFilePath: string) => {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(cipher).pipe(output);

    cipher.on('end', () => {
        const authTag = cipher.getAuthTag();
        fs.writeFileSync(`${outputFilePath}.tag`, authTag);
    });
};

export const decryptFile = (encryptedFilePath: string, outputFilePath: string) => {
    const authTag = fs.readFileSync(`${encryptedFilePath}.tag`);
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);

    const input = fs.createReadStream(encryptedFilePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(decipher).pipe(output);
};
