import { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/config';


declare global {
    namespace Express {
        interface Request {
            user?: string | JwtPayload;
        }
    }
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Access denied, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded as JwtPayload;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Invalid token' });
    }
};
