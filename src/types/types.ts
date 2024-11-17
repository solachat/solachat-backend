import { Request } from 'express';

export interface UserRequest extends Request {
    user?: {
        id: number;
        publicKey: string;
    };
    file?: Express.Multer.File;
}
