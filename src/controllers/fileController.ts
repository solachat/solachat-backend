import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { upload } from '../config/uploadConfig'; // Убедись, что это правильный путь к конфигурации Multer
import {decryptFile, encryptFile} from '../encryption/fileEncryption'; // Убедись, что это правильный путь к функции шифрования

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

        const originalFilePath = path.join(file.destination, file.filename); // Путь к загруженному файлу
        const encryptedFilePath = `${originalFilePath}.enc`; // Путь для зашифрованного файла

        try {
            // Шифруем файл и сохраняем его как зашифрованный
            await encryptFile(originalFilePath); // Оригинальное имя больше не требуется
            console.log(`Файл успешно зашифрован: ${encryptedFilePath}`);

            // Удаляем оригинальный файл после шифрования
            fs.unlinkSync(originalFilePath);
            console.log(`Оригинальный файл удалён: ${originalFilePath}`);

            // Возвращаем успешный ответ с зашифрованным файлом
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
        const encryptedFilePath = path.join('uploads', fileName); // Путь к зашифрованному файлу
        const tempDecryptedFilePath = path.join(__dirname, 'temp', fileName.replace('.enc', '')); // Временный путь для расшифрованного файла

        // Проверка существования зашифрованного файла
        if (!fs.existsSync(encryptedFilePath)) {
            return res.status(404).send('Файл не найден.');
        }

        // Проверка существования директории для временных файлов
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'), { recursive: true });
        }

        // Расшифровка файла
        await decryptFile(encryptedFilePath); // Дешифруем файл

        // Устанавливаем оригинальное имя файла для загрузки (убираем суффикс '.enc')
        const originalFileName = fileName.replace('.enc', ''); // Оригинальное имя файла без суффикса .enc

        // Настройка заголовка для загрузки файла
        res.setHeader('Content-Disposition', `attachment; filename="${originalFileName}"`);

        // Создаём поток для чтения расшифрованного файла и отправляем его клиенту
        const readStream = fs.createReadStream(tempDecryptedFilePath);
        readStream.pipe(res);

        // Удаление временного файла после завершения передачи
        readStream.on('end', () => {
            fs.unlinkSync(tempDecryptedFilePath); // Удаляем временный расшифрованный файл
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
