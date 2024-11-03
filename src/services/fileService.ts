import { File } from '../models/File';
import { encryptFile, decryptFile } from '../encryption/fileEncryption';
import { getDestination, uploadFileToGCS } from '../config/uploadConfig';
import { v4 as uuidv4 } from 'uuid';

export const createFile = async (
    file: Express.Multer.File,
    userId: number,
    chatId: number,
    decrypt: boolean = false
) => {
    try {
        if (!file || !file.buffer) {
            throw new Error('Оригинальный файл отсутствует или его буфер данных недоступен.');
        }

        const uniqueOriginalName = `${uuidv4()}-${file.originalname}`;
        const originalDestinationPath = `${getDestination(file.mimetype)}/${uniqueOriginalName}`;

        const originalPublicUrl = await uploadFileToGCS(file.buffer, originalDestinationPath);
        console.log(`Оригинальный файл загружен в GCS: ${originalPublicUrl}`);

        const encryptedBuffer = await encryptFile(file.buffer);

        const encryptedDestinationPath = `${getDestination(file.mimetype)}/${uniqueOriginalName}.enc`;
        const encryptedPublicUrl = await uploadFileToGCS(encryptedBuffer, encryptedDestinationPath);
        console.log(`Файл успешно зашифрован и загружен в GCS: ${encryptedPublicUrl}`);

        const savedFile = await File.create({
            fileName: uniqueOriginalName,
            filePath: encryptedPublicUrl,
            originalFilePath: originalPublicUrl,
            fileType: file.mimetype,
            userId,
            chatId,
        });

        if (decrypt) {
            const decryptedBuffer = await decryptFile(encryptedBuffer);
            const decryptedUrl = await uploadFileToGCS(decryptedBuffer, encryptedDestinationPath);
            console.log(`Расшифрованный файл загружен в GCS: ${decryptedUrl}`);

            return { savedFile, decryptedFilePath: decryptedUrl };
        }

        return savedFile;

    } catch (error) {
        console.error('Ошибка при создании записи файла в базе данных:', error);
        throw new Error('Ошибка при сохранении файла в базу данных');
    }
};
