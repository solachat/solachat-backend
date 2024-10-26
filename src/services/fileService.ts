import { File } from '../models/File';
import { encryptFile, decryptFile } from '../encryption/fileEncryption';
import { getDestination, uploadFileToGCS } from '../config/uploadConfig';
import path from 'path';

export const createFile = async (
    file: Express.Multer.File,
    userId: number,
    chatId: number,
    decrypt: boolean = false
) => {
    try {
        if (!file || !file.buffer) {
            throw new Error(`Оригинальный файл отсутствует или его буфер данных недоступен.`);
        }

        // Загрузка оригинального файла в Google Cloud Storage
        const originalDestinationPath = `${getDestination(file.mimetype)}/${file.originalname}`;
        const originalPublicUrl = await uploadFileToGCS(file.buffer, originalDestinationPath);
        console.log(`Оригинальный файл загружен в GCS: ${originalPublicUrl}`);

        // Шифруем файл
        const { encryptedBuffer, metadata } = await encryptFile(file.buffer, file.originalname);

        // Определение пути для зашифрованного файла в GCS
        const encryptedDestinationPath = `${getDestination(file.mimetype)}/${file.originalname}.enc`;
        const encryptedPublicUrl = await uploadFileToGCS(encryptedBuffer, encryptedDestinationPath);
        console.log(`Файл успешно зашифрован и загружен в GCS: ${encryptedPublicUrl}`);

        // Загрузка метаданных шифрования в GCS
        const metadataPath = `${encryptedDestinationPath}.meta`;
        await uploadFileToGCS(Buffer.from(JSON.stringify(metadata)), metadataPath);

        // Сохранение записи в базе данных
        const savedFile = await File.create({
            fileName: file.originalname,
            filePath: encryptedPublicUrl, // Ссылка на зашифрованный файл
            originalFilePath: originalPublicUrl, // Ссылка на оригинальный файл
            fileType: file.mimetype,
            userId: userId,
            chatId: chatId,
        });

        if (decrypt) {
            // Дешифруем зашифрованный буфер
            const decryptedBuffer = await decryptFile(encryptedBuffer, metadata);

            // Загрузка расшифрованного файла в GCS
            const decryptedUrl = await uploadFileToGCS(decryptedBuffer, `${encryptedDestinationPath}.decrypted`);
            console.log(`Расшифрованный файл загружен в GCS: ${decryptedUrl}`);

            return { savedFile, decryptedFilePath: decryptedUrl };
        }

        return savedFile;

    } catch (error) {
        console.error('Ошибка при создании записи файла в базе данных:', error);
        throw new Error('Ошибка при сохранении файла в базу данных');
    }
};
