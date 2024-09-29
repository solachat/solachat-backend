import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { UserRequest } from '../types/types';
import { encryptFile } from '../encryption/fileEncryption'; // Импорт функции шифрования файла

// Создание каталога, если он не существует
const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        console.log(`Каталог ${dir} не существует. Создаем...`);
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Получение директории в зависимости от типа файла
const getDestination = (fileExtension: string) => {
    switch (fileExtension) {
        case 'jpeg':
        case 'jpg':
        case 'png':
        case 'gif':
            return 'uploads/images';
        case 'pdf':
        case 'doc':
        case 'docx':
        case 'txt':
            return 'uploads/documents';
        case 'mp4':
        case 'avi':
        case 'mov':
            return 'uploads/videos';
        case 'mp3':
        case 'wav':
            return 'uploads/audio';
        case 'zip':
        case 'rar':
            return 'uploads/archives';
        default:
            return 'uploads/others';
    }
};

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
        const destinationPath = getDestination(fileExtension);

        // Убедимся, что директория существует
        ensureDirectoryExists(destinationPath);

        // Передаем путь для сохранения оригинального файла
        cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
        // Генерируем уникальное имя файла с временным суффиксом
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const fileName = `${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, fileName);
    }
});

const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: FileFilterCallback) => {
    const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'avi', 'mov', 'mp3', 'wav', 'zip', 'rar'];
    const extname = path.extname(file.originalname).toLowerCase().slice(1);
    if (validTypes.includes(extname)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый тип файла. Допустимы только изображения, документы, видео, аудиофайлы и архивы zip/rar.'));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 120 * 1024 * 1024 },
    fileFilter
});

export { ensureDirectoryExists, getDestination };
