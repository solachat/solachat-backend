import { File } from '../models/File';
import { encryptFile, decryptFile } from '../encryption/fileEncryption';
import fs from "fs";

export const createFile = async (
    file: Express.Multer.File,
    userId: number,
    chatId: number,
    decrypt: boolean = false
) => {
    try {
        const encryptedFilePath = `${file.path}.enc`;

        console.log(`Проверка существования оригинального файла: ${file.path}`);
        if (!fs.existsSync(file.path)) {
            throw new Error(`Оригинальный файл не существует по пути: ${file.path}`);
        }

        console.log(`Начало шифрования файла. Оригинальный путь: ${file.path}, путь для шифрования: ${encryptedFilePath}`);

        await encryptFile(file.path);

        console.log(`Проверка существования зашифрованного файла: ${encryptedFilePath}`);
        if (!fs.existsSync(encryptedFilePath)) {
            throw new Error(`Зашифрованный файл не создан по пути: ${encryptedFilePath}`);
        }

        const savedFile = await File.create({
            fileName: file.originalname,
            filePath: encryptedFilePath,
            fileType: file.mimetype,
            userId: userId,
            chatId: chatId,
        });

        if (decrypt) {
            const decryptedFilePath = `${file.path}`;
            console.log(`Начало расшифровки файла. Путь к зашифрованному файлу: ${encryptedFilePath}, путь для расшифровки: ${decryptedFilePath}`);
            await decryptFile(encryptedFilePath);

            console.log(`Проверка существования расшифрованного файла: ${decryptedFilePath}`);
            if (!fs.existsSync(decryptedFilePath)) {
                throw new Error(`Расшифрованный файл не создан по пути: ${decryptedFilePath}`);
            }

            return { savedFile, decryptedFilePath };
        }

        return savedFile;

    } catch (error) {
        console.error('Ошибка при создании записи файла в базе данных:', error);
        throw new Error('Ошибка при сохранении файла в базу данных');
    }
};
