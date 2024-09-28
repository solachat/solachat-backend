import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UserRequest } from '../types/types';

const algorithm = 'aes-256-gcm';
const rsaPublicKey = fs.readFileSync('public.key', 'utf8');

// Создание каталога, если он не существует
const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        console.log(`Directory ${dir} doesn't exist. Creating...`);
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

// Шифрование файла и пути
const encryptFile = (filePath: string, outputFilePath: string) => {
    return new Promise<void>((resolve, reject) => {
        const aesKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(12);

        const cipher = crypto.createCipheriv(algorithm, aesKey, iv);
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(outputFilePath);

        input.pipe(cipher).pipe(output);

        cipher.on('finish', () => {
            const authTag = cipher.getAuthTag();

            // Шифрование AES-ключа с помощью RSA
            const encryptedAesKey = crypto.publicEncrypt(rsaPublicKey, aesKey);

            const metadata = {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encryptedAesKey: encryptedAesKey.toString('hex'),
                originalFilePath: filePath, // Сохраняем оригинальный путь для возможной расшифровки
            };

            // Сохранение метаданных
            fs.writeFileSync(`${outputFilePath}.meta`, JSON.stringify(metadata));
            resolve(); // Завершаем успешно
        });

        cipher.on('error', (err) => {
            console.error('Ошибка при шифровании файла:', err);
            reject(err); // Возвращаем ошибку
        });
    });
};

const storage = multer.diskStorage({
    destination: (req: UserRequest, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
        const destinationPath = getDestination(fileExtension);
        ensureDirectoryExists(destinationPath); // Создаем директорию, если не существует
        cb(null, destinationPath); // Указываем путь для сохранения файла
    },
    filename: (req: UserRequest, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const encryptedFileName = `encrypted-${uniqueSuffix}${path.extname(file.originalname)}`;
        cb(null, encryptedFileName); // Генерируем имя файла
    }
});


// Фильтр для допустимых типов файлов
const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'avi', 'mov', 'mp3', 'wav', 'zip', 'rar'];
    const extname = path.extname(file.originalname).toLowerCase().slice(1);
    if (validTypes.includes(extname)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, documents, videos, audio files, and zip/rar archives are allowed.'));
    }
};

// Настройка Multer с шифрованием пути и файла
export const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter
});

export { ensureDirectoryExists, getDestination };
