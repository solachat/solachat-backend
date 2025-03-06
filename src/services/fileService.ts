import { File } from '../models/File';
import { encryptFile, decryptFile } from '../encryption/fileEncryption';
import fs from 'fs';
import path from 'path';
import redisClient from '../config/redisClient';

export const createFile = async (
    file: Express.Multer.File,
    userId: number,
    chatId: number,
    decrypt: boolean = false
) => {
    try {
        console.log(`Проверка существования оригинального файла: ${file.path}`);
        if (!fs.existsSync(file.path)) {
            throw new Error(`Оригинальный файл не существует по пути: ${file.path}`);
        }

        console.log(`Читаем содержимое файла перед шифрованием: ${file.path}`);
        const fileBuffer = fs.readFileSync(file.path);

        console.log(`Начало шифрования файла.`);
        const encryptedBuffer = await encryptFile(fileBuffer);

        console.log(`Перезаписываем зашифрованный файл: ${file.path}`);
        fs.writeFileSync(file.path, encryptedBuffer);

        console.log(`Проверка существования зашифрованного файла.`);
        if (!fs.existsSync(file.path)) {
            throw new Error(`Зашифрованный файл не создан по пути: ${file.path}`);
        }

        const savedFile = await File.create({
            fileName: file.originalname,
            filePath: file.path,
            fileType: file.mimetype,
            userId: userId,
            chatId: chatId,
        });

        const redisKey = `file:${savedFile.id}`;
        await redisClient.setEx(redisKey, 3600, JSON.stringify(savedFile));

        if (decrypt) {
            console.log(`Читаем зашифрованный файл для расшифровки.`);
            const encryptedData = fs.readFileSync(file.path);

            console.log(`Начало расшифровки файла.`);
            const decryptedBuffer = await decryptFile(encryptedData);

            console.log(`Перезаписываем расшифрованный файл: ${file.path}`);
            fs.writeFileSync(file.path, decryptedBuffer);

            console.log(`Проверка существования расшифрованного файла.`);
            if (!fs.existsSync(file.path)) {
                throw new Error(`Расшифрованный файл не создан по пути: ${file.path}`);
            }

            return { savedFile, decryptedFilePath: file.path };
        }

        return savedFile;
    } catch (error) {
        console.error('Ошибка при создании записи файла в базе данных:', error);
        throw new Error('Ошибка при сохранении файла в базу данных');
    }
};
