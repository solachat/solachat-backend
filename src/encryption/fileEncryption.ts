import fs from 'fs';
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const rsaPublicKey = fs.readFileSync('public.key', 'utf8');
const rsaPrivateKey = fs.readFileSync('private.key', 'utf8');

// Шифрование файла и сохранение метаданных с оригинальным именем файла
export const encryptFile = (filePath: string, outputFilePath: string, originalFileName: string) => {
    return new Promise<void>((resolve, reject) => {
        const aesKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(12);

        const cipher = crypto.createCipheriv(algorithm, aesKey, iv);
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(outputFilePath);

        input.pipe(cipher).pipe(output);

        cipher.on('finish', () => {
            const authTag = cipher.getAuthTag();

            // Шифрование AES-ключа с помощью RSA
            const encryptedAesKey = crypto.publicEncrypt(rsaPublicKey, aesKey);

            const metadata = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encryptedAesKey: encryptedAesKey.toString('hex'),
                originalFileName // Сохраняем оригинальное имя файла
            };

            // Сохранение метаданных
            fs.writeFileSync(`${outputFilePath}.meta`, JSON.stringify(metadata));
            resolve(); // Завершаем успешно
        });

        cipher.on('error', (err) => {
            console.error('Ошибка при шифровании файла:', err);
            reject(err); // Возвращаем ошибку
        });
    });
};

// Функция для расшифровки файла
export const decryptFile = (encryptedFilePath: string, outputFilePath: string, metadataPath: string) => {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    const iv = Buffer.from(metadata.iv, 'hex');
    const authTag = Buffer.from(metadata.authTag, 'hex');
    const encryptedAesKey = Buffer.from(metadata.encryptedAesKey, 'hex');

    // Дешифрование AES-ключа с использованием RSA
    const aesKey = crypto.privateDecrypt(rsaPrivateKey, encryptedAesKey);

    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAuthTag(authTag); // Устанавливаем тег аутентификации

    const input = fs.createReadStream(encryptedFilePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(decipher).pipe(output);

    output.on('finish', () => {
        console.log('Файл успешно расшифрован');
    });

    decipher.on('error', (err) => {
        console.error('Ошибка при расшифровке файла:', err);
        throw err;
    });

    input.on('error', (err) => {
        console.error('Ошибка чтения зашифрованного файла:', err);
        throw err;
    });

    output.on('error', (err) => {
        console.error('Ошибка записи расшифрованного файла:', err);
        throw err;
    });
};
