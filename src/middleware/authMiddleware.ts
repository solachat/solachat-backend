import { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                publicKey: string;
            };
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        console.error("No token provided");
        return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload | string;
        if (typeof decoded === 'object' && 'id' in decoded && 'publicKey' in decoded) {
            req.user = {
                id: decoded.id as number,
                publicKey: decoded.publicKey as string,
            };
            next();
        } else {
            console.error("Invalid token structure:", decoded);
            return res.status(401).json({ message: 'Invalid token structure' });
        }
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};
