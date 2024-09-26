import { Response as ExpressResponse } from 'express';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const directories = [
    'uploads/images',
    'uploads/documents',
    'uploads/archives',
    'uploads/audio',
    'uploads/videos',
    'uploads/others'
];

export const findEncryptedFile = async (fileName: string): Promise<string | null> => {
    for (const directory of directories) {
        const filePath = path.join(directory, `${fileName}.enc`);

        if (fs.existsSync(filePath)) {
            return filePath;
        }
    }

    return null;
};

export const decryptFileStream = (encryptedFilePath: string, res: ExpressResponse) => {
    const encryptedMetaPath = `${encryptedFilePath}.meta`;

    if (!fs.existsSync(encryptedMetaPath)) {
        throw new Error('Метаданные для файла не найдены.');
    }

    const metadata = JSON.parse(fs.readFileSync(encryptedMetaPath, 'utf8'));
    const iv = Buffer.from(metadata.iv, 'hex');
    const authTag = Buffer.from(metadata.authTag, 'hex');
    const encryptedAesKey = Buffer.from(metadata.encryptedAesKey, 'hex');
    const aesKey = crypto.privateDecrypt(fs.readFileSync('private.key', 'utf8'), encryptedAesKey);

    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);

    decipher.setAuthTag(authTag);
    const input = fs.createReadStream(encryptedFilePath);
    input.pipe(decipher).pipe(res);

    return input
};
