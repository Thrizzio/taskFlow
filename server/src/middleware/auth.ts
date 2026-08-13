import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../utils/config';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        name: string;
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: missing token' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET as string) as any;
        req.user = { userId: decoded.userId, name: decoded.name };
        next();
    } catch (err) {
        res.status(401).json({ error: 'Unauthorized: invalid token' });
        return;
    }
};
