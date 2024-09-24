import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const algorithm = 'aes-256-gcm';
const rsaPublicKey = fs.readFileSync('public.key', 'utf8');
const rsaPrivateKey = fs.readFileSync('private.key', 'utf8');

// Функция шифрования файла
export const encryptFile = (filePath: string, outputFilePath: string) => {
    const aesKey = crypto.randomBytes(32); // Генерация AES-ключа
    const iv = crypto.randomBytes(12); // Вектор инициализации

    const cipher = crypto.createCipheriv(algorithm, aesKey, iv); // Создаем шифр AES
    const input = fs.createReadStream(filePath); // Исходный файл
    const output = fs.createWriteStream(outputFilePath); // Зашифрованный файл

    input.pipe(cipher).pipe(output);

    cipher.on('end', () => {
        const authTag = cipher.getAuthTag(); // Получаем тэг аутентификации

        // Шифруем AES-ключ с помощью RSA
        const encryptedAesKey = crypto.publicEncrypt(rsaPublicKey, aesKey);

        // Сохраняем метаданные в .meta файл
        const metadata = {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encryptedAesKey: encryptedAesKey.toString('hex'),
        };

        fs.writeFileSync(`${outputFilePath}.meta`, JSON.stringify(metadata));

        // **Не удаляем исходный файл**, он будет использоваться для фронтенда
    });

    cipher.on('error', (err) => {
        console.error('Ошибка при шифровании файла:', err);
        throw err;
    });
};

export const decryptFile = (encryptedFilePath: string, outputFilePath: string) => {
    console.log(`Расшифровка файла: ${encryptedFilePath} -> ${outputFilePath}`);
    const metadata = JSON.parse(fs.readFileSync(`${encryptedFilePath}.meta`, 'utf8'));
    const iv = Buffer.from(metadata.iv, 'hex');
    const authTag = Buffer.from(metadata.authTag, 'hex');
    const encryptedAesKey = Buffer.from(metadata.encryptedAesKey, 'hex');

    const aesKey = crypto.privateDecrypt(rsaPrivateKey, encryptedAesKey);

    const decipher = crypto.createDecipheriv(algorithm, aesKey, iv);
    decipher.setAuthTag(authTag);

    const input = fs.createReadStream(encryptedFilePath);
    const output = fs.createWriteStream(outputFilePath);

    input.pipe(decipher).pipe(output);

    decipher.on('end', () => {
        console.log(`Файл успешно расшифрован и записан в: ${outputFilePath}`);
    });

    decipher.on('error', (err) => {
        console.error('Ошибка при расшифровке файла:', err);
        throw err;
    });
};

// Шифрование имени файла
export const encryptFileName = (fileName: string): string => {
    const key = crypto.randomBytes(32); // Ключ для шифрования имени файла
    const iv = crypto.randomBytes(16);  // Вектор инициализации
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(fileName, 'utf8', 'base64'); // Используем Base64
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${encrypted}.${authTag}`;
};

// Расшифровка имени файла
export const decryptFileName = (encryptedFileName: string): string => {
    const key = crypto.randomBytes(32); // Ключ для шифрования имени файла
    const iv = crypto.randomBytes(16);  // Вектор инициализации
    const [encrypted, authTag] = encryptedFileName.split('.');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

