import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const algorithm = 'aes-256-gcm';
// Генерация фиксированного 32-байтового ключа
const key = Buffer.from('e03ed966249b166b574e5035fe1e22c6ee5ac44ec5bf250d85ff523ba073c93b', 'hex'); // Используйте фиксированный ключ


export const encryptFile = (filePath: string) => {
    return new Promise<void>((resolve, reject) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const originalFileName = path.basename(filePath);
        const directory = path.dirname(filePath);
        const encryptedFileName = `${originalFileName}.enc`;
        const encryptedFilePath = path.join(directory, encryptedFileName);

        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(encryptedFilePath);

        input.pipe(cipher).pipe(output);

        output.on('finish', () => {
            const authTag = cipher.getAuthTag();
            const metadata = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                originalFileName
            };

            const metadataPath = `${encryptedFilePath}.meta`;
            fs.writeFileSync(metadataPath, JSON.stringify(metadata));

            console.log(`Файл успешно зашифрован: ${encryptedFilePath}`);
            fs.unlinkSync(filePath);
            resolve();
        });

        cipher.on('error', (err) => {
            console.error('Ошибка при шифровании:', err);
            reject(err);
        });
    });
};

export const decryptFile = (encryptedFilePath: string) => {
    return new Promise<void>((resolve, reject) => {
        const metadataPath = `${encryptedFilePath}.meta`;

        console.log(`Проверка метаданных: ${metadataPath}`);
        if (!fs.existsSync(metadataPath)) {
            return reject(new Error(`Метаданные для ${encryptedFilePath} не найдены.`));
        }

        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const iv = Buffer.from(metadata.iv, 'hex');
        const authTag = Buffer.from(metadata.authTag, 'hex');
        const originalFileName = metadata.originalFileName;

        console.log(`IV: ${iv.toString('hex')}, AuthTag: ${authTag.toString('hex')}`);

        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);

        const input = fs.createReadStream(encryptedFilePath);
        const outputFilePath = path.join(path.dirname(encryptedFilePath), originalFileName);

        const output = fs.createWriteStream(outputFilePath);

        input.pipe(decipher).pipe(output);

        output.on('finish', () => {
            console.log(`Файл успешно расшифрован: ${outputFilePath}`);
            resolve();
        });

        decipher.on('error', (err) => {
            console.error('Ошибка при дешифровке:', err);
            reject(err);
        });
    });
};

