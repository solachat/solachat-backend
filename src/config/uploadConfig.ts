import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UserRequest } from '../types/types';

const ensureDirectoryExists = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const getDestination = (fileType: string) => {
    switch (fileType) {
        case 'avatar':
            return 'uploads/avatars';
        case 'document':
            return 'uploads/documents';
        case 'video':
            return 'uploads/videos';
        case 'audio':
            return 'uploads/audio';
        default:
            return 'uploads/others';
    }
};

const storage = multer.diskStorage({
    destination: (req: UserRequest, file, cb) => {
        let fileType = req.body.fileType;

        if (!fileType) {
            const imageTypes = /jpeg|jpg|png|gif/;
            const extname = path.extname(file.originalname).toLowerCase();
            if (imageTypes.test(extname)) {
                fileType = 'avatar';
            } else {
                fileType = 'others';
            }
        }

        const destinationPath = getDestination(fileType);
        ensureDirectoryExists(destinationPath);

        cb(null, destinationPath);
    },
    filename: (req: UserRequest, file, cb) => {
        if (req.user && req.user.username) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, `${req.user.username}-${uniqueSuffix}${path.extname(file.originalname)}`);
        } else {
            cb(new Error('User information is missing.'), '');
        }
    }
});


const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const imageTypes = /jpeg|jpg|png|gif/;
    const documentTypes = /pdf|doc|docx|xls|xlsx/;
    const videoTypes = /mp4|mov|avi|mkv/;
    const audioTypes = /mp3|wav|ogg/;

    const extname = path.extname(file.originalname).toLowerCase();
    const isImage = imageTypes.test(extname);
    const isDocument = documentTypes.test(extname);
    const isVideo = videoTypes.test(extname);
    const isAudio = audioTypes.test(extname);

    const validMimeTypes = isImage || isDocument || isVideo || isAudio;

    if (validMimeTypes) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, documents, videos, and audio files are allowed.'));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter
});
