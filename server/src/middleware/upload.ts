import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import config from '../utils/config';

// Explicit whitelist of allowed MIME types and file extensions
export const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/plain',
    'text/markdown',
]);

export const ALLOWED_EXTENSIONS = new Set([
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.txt',
    '.md',
]);

// Ensure upload directory exists
const uploadDirectory = path.resolve(config.UPLOAD_DIR);
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

// Ensure safe server-side storage
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (_req, file, cb) => {
        // Never trust user-provided filename on filesystem
        // Generate random UUID with preserved and validated extension
        const ext = path.extname(file.originalname).toLowerCase();
        const safeServerFilename = `${crypto.randomUUID()}${ext}`;
        cb(null, safeServerFilename);
    },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error('Invalid file type. Allowed formats: PDF, PNG, JPEG, TXT, Markdown'));
    }

    cb(null, true);
};

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 Megabytes strict limit
        files: 1, // Only 1 file per request
    },
});

/**
 * Path traversal verification utility.
 * Verifies that the resolved path strictly resides inside the allowed directory.
 */
export function isSafeFilePath(baseDir: string, filePath: string): boolean {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(filePath);
    return resolvedTarget.startsWith(resolvedBase + path.sep);
}

/**
 * Multer error handling wrapper middleware.
 */
export function handleUpload(fieldName: string) {
    const uploadSingle = upload.single(fieldName);

    return (req: Request, res: Response, next: NextFunction): void => {
        uploadSingle(req, res, (err: any) => {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        res.status(400).json({ error: 'File exceeds strict 5MB size limit' });
                        return;
                    }
                    res.status(400).json({ error: `Upload error: ${err.message}` });
                    return;
                }
                res.status(400).json({ error: err.message || 'File upload failed' });
                return;
            }
            next();
        });
    };
}
