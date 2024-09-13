import multer from 'multer';
import path from 'path';
import { Request } from 'express';
import { UserRequest } from '../types/types';

const storage = multer.diskStorage({
    destination: (req: Request, file, cb) => {
        cb(null, 'uploads/avatars');
    },
    filename: (req: UserRequest, file, cb) => {
        if (req.user && req.user.username) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, `${req.user.username}-${uniqueSuffix}${path.extname(file.originalname)}`);
        } else {
            cb(new Error('User information is missing.'), '');
        }
    }
});

const fileFilter = (req: UserRequest, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only images (jpeg, jpg, png, gif) are allowed.'));
    }
};

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
});
