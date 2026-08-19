/**
 * Request Body Validation Middleware
 *
 * A tiny schema-based validator. Each schema entry maps a field name to its
 * validation rule.  The middleware factory returns an Express middleware that:
 *   1. Checks each required field is present and non-empty.
 *   2. Runs optional type/format checks.
 *   3. Returns HTTP 400 with an error message on failure.
 *   4. Calls next() on success — the controller never executes on invalid input.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), register);
 */

import { Request, Response, NextFunction } from 'express';

// ── Field rules ───────────────────────────────────────────────────────────────

export interface FieldRule {
    required?: boolean;
    type?: 'string' | 'number';
    minLength?: number;
    /** Basic email format check */
    isEmail?: boolean;
}

export type ValidationSchema = Record<string, FieldRule>;

// ── Middleware factory ────────────────────────────────────────────────────────

export function validate(schema: ValidationSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        for (const [field, rule] of Object.entries(schema)) {
            const value = req.body?.[field];

            if (rule.required && (value === undefined || value === null || value === '')) {
                res.status(400).json({ error: `${field} is required` });
                return;
            }

            // Skip further checks if the value is absent and not required
            if (value === undefined || value === null) continue;

            if (rule.type === 'string' && typeof value !== 'string') {
                res.status(400).json({ error: `${field} must be a string` });
                return;
            }

            if (rule.minLength !== undefined && typeof value === 'string' && value.length < rule.minLength) {
                res.status(400).json({ error: `${field} must be at least ${rule.minLength} characters` });
                return;
            }

            if (rule.isEmail) {
                // Simple email check: must contain @ and a dot after it
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (typeof value !== 'string' || !emailRegex.test(value)) {
                    res.status(400).json({ error: `${field} must be a valid email address` });
                    return;
                }
            }
        }

        next();
    };
}

// ── Reusable schemas for the four validated endpoints ─────────────────────────

export const registerSchema: ValidationSchema = {
    name: { required: true, type: 'string', minLength: 1 },
    email: { required: true, type: 'string', isEmail: true },
    password: { required: true, type: 'string', minLength: 6 },
};

export const loginSchema: ValidationSchema = {
    email: { required: true, type: 'string', isEmail: true },
    password: { required: true, type: 'string', minLength: 1 },
};

export const createTaskSchema: ValidationSchema = {
    title: { required: true, type: 'string', minLength: 1 },
};

export const agentRequestSchema: ValidationSchema = {
    request: { required: true, type: 'string', minLength: 1 },
};
