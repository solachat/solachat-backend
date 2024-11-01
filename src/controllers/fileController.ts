import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { upload } from '../config/uploadConfig';
import {decryptFile, encryptFile} from '../encryption/fileEncryption';

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

        const originalFilePath = path.join(file.destination, file.filename);
        const encryptedFilePath = `${originalFilePath}.enc`;

        try {
            await encryptFile(await fs.promises.readFile(originalFilePath));
            console.log(`Файл успешно зашифрован: ${encryptedFilePath}`);

            fs.unlinkSync(originalFilePath);
            console.log(`Оригинальный файл удалён: ${originalFilePath}`);

            return res.status(200).send({
                message: 'Файл успешно загружен и зашифрован.',
                filePath: encryptedFilePath
            });
        } catch (err) {
            console.error('Ошибка при шифровании файла:', err);
            return res.status(500).send('Ошибка при шифровании файла.');
        }
    });
};

export const downloadFileController = async (req: Request, res: Response) => {
    const fileName = req.params.filename;

    try {
        const encryptedFilePath = path.join('uploads', fileName);
        const tempDecryptedFilePath = path.join(__dirname, 'temp', fileName.replace('.enc', ''));
        const metadataPath = `${encryptedFilePath}.meta`;

        if (!fs.existsSync(encryptedFilePath)) {
            return res.status(404).send('Файл не найден.');
        }

        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
        }

        const encryptedBuffer = await fs.promises.readFile(encryptedFilePath);
        await decryptFile(encryptedBuffer);

        const originalFileName = fileName.replace('.enc', '');

        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);

        const readStream = fs.createReadStream(tempDecryptedFilePath);
        readStream.pipe(res);

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
