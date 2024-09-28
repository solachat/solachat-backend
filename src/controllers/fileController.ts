import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { upload } from '../config/uploadConfig';
import { encryptFile, decryptFile } from '../encryption/fileEncryption'; // Корректный импорт

// Контроллер для загрузки файла с шифрованием
export const uploadFileController = (req: Request, res: Response) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('Ошибка при загрузке файла:', err);
            return res.status(500).send('Ошибка при загрузке файла.');
        }

        const file = req.file;
        if (!file) {
            return res.status(400).send('Файл не найден.');
        }

        const originalFilePath = path.join(file.destination, file.filename); // Путь к сохраненному файлу
        const encryptedFilePath = `${originalFilePath}.enc`; // Путь для зашифрованного файла

        try {
            // Шифруем файл и сохраняем оригинальное имя
            await encryptFile(originalFilePath, encryptedFilePath, file.originalname);
            console.log(`Файл успешно зашифрован: ${encryptedFilePath}`);

            // Удаляем оригинальный файл после шифрования
            fs.unlinkSync(originalFilePath);

            return res.status(200).send({ message: 'Файл успешно загружен и зашифрован.', filePath: encryptedFilePath });
        } catch (err) {
            console.error('Ошибка при шифровании файла:', err);
            return res.status(500).send('Ошибка при шифровании файла.');
        }
    });
};

// Контроллер для скачивания и расшифровки файла
export const downloadFileController = async (req: Request, res: Response) => {
    const fileName = req.params.filename;

    try {
        const encryptedFilePath = path.join('uploads', fileName); // Путь к зашифрованным файлам
        const tempDecryptedFilePath = path.join(__dirname, 'temp', fileName.replace('.enc', ''));
        const metadataPath = `${encryptedFilePath}.meta`;

        // Проверка наличия метаданных
        if (!fs.existsSync(metadataPath)) {
            return res.status(404).send('Метаданные для файла не найдены.');
        }

        // Загружаем метаданные для получения оригинального имени файла
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const originalFileName = metadata.originalFileName || fileName.replace('.enc', '');

        // Расшифровываем файл
        await decryptFile(encryptedFilePath, tempDecryptedFilePath, metadataPath);

        // Устанавливаем оригинальное имя файла для загрузки
        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);
        const readStream = fs.createReadStream(tempDecryptedFilePath);
        readStream.pipe(res);

        // Удаление временного файла
        readStream.on('end', () => {
            fs.unlinkSync(tempDecryptedFilePath);
        });

        readStream.on('error', (err) => {
            console.error('Ошибка при передаче файла:', err);
            res.status(500).send('Ошибка при передаче файла.');
        });
    } catch (error) {
        console.error('Ошибка при скачивании файла:', error);
        res.status(500).send('Ошибка при скачивании файла.');
    }
};
