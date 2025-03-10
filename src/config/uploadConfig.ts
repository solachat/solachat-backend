import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";
import { UserRequest } from "../types/types";

const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        console.log(`📁 Каталог ${dir} не существует. Создаем...`);
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Функция для определения папки сохранения файла по его расширению
const getDestination = (fileExtension: string) => {
    const destinations: { [key: string]: string } = {
        jpeg: "uploads/images",
        jpg: "uploads/images",
        png: "uploads/images",
        gif: "uploads/images",
        pdf: "uploads/documents",
        doc: "uploads/documents",
        docx: "uploads/documents",
        txt: "uploads/documents",
        mp4: "uploads/videos",
        avi: "uploads/videos",
        mov: "uploads/videos",
        mp3: "uploads/audio",
        wav: "uploads/audio",
        zip: "uploads/archives",
        rar: "uploads/archives",
    };
    return destinations[fileExtension] || "uploads/others";
};

// Определение хранилища для файлов Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1);
        const destinationPath = getDestination(fileExtension);

        ensureDirectoryExists(destinationPath);
        cb(null, destinationPath);
    },
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, fileExtension);
        const safeFileName = `${baseName}-${Date.now()}${fileExtension}`;

        cb(null, safeFileName);
    }
});

// Фильтр для проверки допустимых типов файлов
const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: FileFilterCallback) => {
    const validTypes = [
        "jpeg", "jpg", "png", "gif",
        "pdf", "doc", "docx", "txt",
        "mp4", "avi", "mov",
        "mp3", "wav",
        "zip", "rar"
    ];

    const extname = path.extname(file.originalname).toLowerCase().slice(1);

    if (validTypes.includes(extname)) {
        cb(null, true);
    } else {
        console.error(`❌ Ошибка: Недопустимый тип файла: ${extname}`);
        cb(new Error("Недопустимый тип файла. Допустимы изображения, документы, видео, аудиофайлы и архивы."));
    }
};

// Настройки Multer с поддержкой нескольких файлов
export const upload = multer({
    storage,
    limits: { fileSize: 120 * 1024 * 1024 }, // Ограничение в 120MB
    fileFilter
});

// Мидлвар для загрузки **нескольких файлов**
export const uploadMiddleware = upload.array("files", 10); // Максимум 10 файлов за раз

export { ensureDirectoryExists, getDestination };
