import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { Multer } from 'multer';

export interface UserRequest extends Request {
    user?: {
        id: number;
        username: string;
    };
    file?: Express.Multer.File;
}
