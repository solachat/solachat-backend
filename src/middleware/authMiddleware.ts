import { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';
import { UserRequest } from '../types/types';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                username: string;
            };
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload | string;

        if (typeof decoded === 'object' && 'id' in decoded && 'username' in decoded) {
            req.user = {
                id: decoded.id as number,
                username: decoded.username as string,
            };
            next();
        } else {
            return res.status(401).json({ message: 'Invalid token structure' });
        }
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
