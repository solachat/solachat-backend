import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { upload } from '../config/uploadConfig';
import { decryptFile, encryptFile } from '../encryption/fileEncryption';

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

        try {
            // Чтение файла как Buffer
            const fileBuffer = await fs.readFile(file.path);

            // Шифрование файла
            const { encryptedBuffer, metadata } = await encryptFile(fileBuffer, file.originalname);

            // Определение пути для сохранения зашифрованного файла
            const encryptedFilePath = `${file.path}.enc`;
            await fs.writeFile(encryptedFilePath, encryptedBuffer);
            await fs.writeFile(`${encryptedFilePath}.meta`, JSON.stringify(metadata));

            // Удаление оригинального файла
            await fs.unlink(file.path);
            console.log(`Файл успешно зашифрован и сохранен: ${encryptedFilePath}`);

            return res.status(200).send({
                message: 'Файл успешно загружен и зашифрован.',
                filePath: encryptedFilePath
            });
        } catch (error) {
            console.error('Ошибка при шифровании файла:', error);
            return res.status(500).send('Ошибка при шифровании файла.');
        }
    });
};

export const downloadFileController = async (req: Request, res: Response) => {
    const fileName = req.params.filename;

    try {
        const encryptedFilePath = path.join('uploads', fileName);
        const metadataPath = `${encryptedFilePath}.meta`;

        if (!(await fs.access(encryptedFilePath).then(() => true).catch(() => false))) {
            return res.status(404).send('Файл не найден.');
        }

        if (!(await fs.access(metadataPath).then(() => true).catch(() => false))) {
            return res.status(404).send('Метаданные не найдены.');
        }

        // Чтение зашифрованного файла и метаданных
        const encryptedBuffer = await fs.readFile(encryptedFilePath);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

        // Расшифровка файла
        const decryptedBuffer = await decryptFile(encryptedBuffer, metadata);

        // Временный путь для расшифрованного файла
        const tempDecryptedFilePath = path.join(__dirname, 'temp', fileName.replace('.enc', ''));

        // Сохранение расшифрованного файла
        await fs.writeFile(tempDecryptedFilePath, decryptedBuffer);

        res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalFileName}"`);
        res.sendFile(tempDecryptedFilePath, {}, async (err) => {
            if (err) {
                console.error('Ошибка при передаче файла:', err);
            } else {
                // Удаление временного расшифрованного файла после отправки
                await fs.unlink(tempDecryptedFilePath);
            }
        });

    } catch (error) {
        console.error('Ошибка при скачивании файла:', error);
        res.status(500).send('Ошибка при скачивании файла.');
    }
};
