import express from 'express';
import path from 'path';
import fs from 'fs';
import { ensureDirectoryExists } from '../config/uploadConfig';

const router = express.Router();

// Список возможных папок для файлов
const directories = [
    'uploads/images',
    'uploads/documents',
    'uploads/archives',
    'uploads/audio',
    'uploads/videos',
    'uploads/others'
];

router.get('/:filename', (req, res) => {
    const fileName = req.params.filename;
    let fileFound = false; // Флаг для проверки, был ли найден файл

    // Перебираем все возможные директории
    for (const directory of directories) {
        const filePath = path.join(directory, fileName);

        // Проверяем, существует ли файл
        if (fs.existsSync(filePath)) {
            ensureDirectoryExists(directory); // Проверка существования директории

            // Отправляем файл на скачивание
            res.download(filePath, fileName, (err) => {
                if (err) {
                    console.error('Ошибка при скачивании файла:', err);
                    return res.status(500).send('Ошибка при скачивании файла.');
                }
            });

            fileFound = true; // Устанавливаем флаг в true, если файл найден
            break; // Выходим из цикла после нахождения файла
        }
    }

    // Если файл не найден ни в одной из директорий
    if (!fileFound) {
        return res.status(404).send('Файл не найден.');
    }
});

export default router;
