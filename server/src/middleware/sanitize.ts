import { Request, Response, NextFunction } from 'express';
import { sanitizeMongoInput, sanitizeString } from '../utils/sanitize';

/**
 * Express middleware that strips MongoDB operator keys ($*, .) and cleans
 * user-controlled string inputs from request body, params, and query.
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeMongoInput(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeMongoInput(req.query);
    }
    if (req.params && typeof req.params === 'object') {
        for (const [key, val] of Object.entries(req.params)) {
            if (typeof val === 'string') {
                req.params[key] = sanitizeString(val);
            }
        }
    }
    next();
}
