import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Role-based Authorization Middleware.
 *
 * Authentication (authenticate): determines WHO the user is by verifying their JWT.
 * Authorization (requireRole): determines WHAT the authenticated user is allowed to do.
 *
 * If unauthenticated -> 401 Unauthorized
 * If authenticated but lacking required role -> 403 Forbidden
 */
export function requireRole(...allowedRoles: ('user' | 'admin')[]) {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized: missing authentication' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden: insufficient permissions for this resource' });
            return;
        }

        next();
    };
}

