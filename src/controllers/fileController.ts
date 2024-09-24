import { Request, Response } from 'express';
import { decryptFileStream, findEncryptedFile } from '../services/fileService';
import {UserRequest} from "../types/types";
import path from "path";
import {ensureDirectoryExists, getDestination} from "../config/uploadConfig";
import {encryptFile} from "../encryption/fileEncryption";
import File from "../models/File";

export const uploadFileController = async (req: UserRequest, res: Response) => {
    const file = req.file;
    const chatId = req.body.chatId;

    if (!file) {
        return res.status(400).json({ message: 'Файл не найден.' });
    }

    if (!chatId) {
        return res.status(400).json({ message: 'Chat ID обязателен.' });
    }

    try {
        const fileExtension = path.extname(file.originalname).slice(1);
        const destinationPath = getDestination(fileExtension);
        ensureDirectoryExists(destinationPath);

        const relativeFilePath = `${destinationPath}/${file.filename}`;
        console.log(`Оригинальный файл сохранен: ${relativeFilePath}`);

        const encryptedFilePath = `${relativeFilePath}.enc`;
        encryptFile(relativeFilePath, encryptedFilePath);

        const uploadedFile = await File.create({
            fileName: file.filename,
            fileType: fileExtension,
            filePath: encryptedFilePath,
            userId: req.user!.id,
            chatId: Number(chatId),
        });

        const fileUrl = `${req.protocol}://${req.get('host')}/${relativeFilePath}`;
        res.status(200).json({ filePath: fileUrl });
    } catch (error) {
        console.error('Ошибка при загрузке файла:', error);
        res.status(500).json({ message: 'Ошибка при загрузке файла.' });
    }
};


export const downloadFileController = async (req: Request, res: Response) => {
    const fileName = req.params.filename;

    try {
        const encryptedFilePath = await findEncryptedFile(fileName);

        if (encryptedFilePath) {
            res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

            decryptFileStream(encryptedFilePath, res).on('error', (err) => {
                console.error('Ошибка при передаче файла:', err);
                res.status(500).send('Ошибка при передаче файла.');
            });
        } else {
            return res.status(404).send('Файл не найден.');
        }
    } catch (error) {
        console.error('Ошибка при скачивании файла:', error);
        return res.status(500).send('Ошибка при скачивании файла.');
    }
};
