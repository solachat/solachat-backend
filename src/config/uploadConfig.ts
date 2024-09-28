import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UserRequest } from '../types/types';

const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        console.log(`Directory ${dir} doesn't exist. Creating...`);
        fs.mkdirSync(dir, { recursive: true });
    }
};

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

const storage = multer.diskStorage({
    destination: (req: UserRequest, file, cb) => {
        const fileExtension = path.extname(file.originalname).toLowerCase().slice(1)

        const destinationPath = getDestination(fileExtension);
        ensureDirectoryExists(destinationPath);

        cb(null, destinationPath);
    },
    filename: (req: UserRequest, file, cb) => {
        console.log('User in filename:', req.user)
        if (req.user && req.user.username) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${req.user.username}-${uniqueSuffix}${path.extname(file.originalname)}`);
        } else {
            cb(new Error('User information is missing.'), '');
        }
    }
});

const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const validTypes = ['jpeg', 'jpg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'mp4', 'avi', 'mov', 'mp3', 'wav', 'zip', 'rar'];
    const extname = path.extname(file.originalname).toLowerCase().slice(1);
    if (validTypes.includes(extname)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, documents, videos, audio files, and zip/rar archives are allowed.'))
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter
});

export { ensureDirectoryExists, getDestination };
