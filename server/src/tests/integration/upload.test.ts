import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

// Mock config with a dedicated temporary upload directory for tests
const TEST_UPLOAD_DIR = path.resolve(__dirname, '../../test_uploads');

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-upload-tests',
        UPLOAD_DIR: path.resolve(__dirname, '../../test_uploads'),
        PORT: 4001,
    },
    validateEnv: vi.fn(),
}));

const mockTasksDatabase: Record<string, any> = {};

vi.mock('../../models/Task', () => ({
    Task: {
        findOne: vi.fn().mockImplementation(({ _id, userId }) => {
            const task = mockTasksDatabase[_id];
            if (task && task.userId === userId) {
                return {
                    ...task,
                    save: vi.fn().mockImplementation(async function (this: any) {
                        mockTasksDatabase[_id] = this;
                        return this;
                    }),
                };
            }
            return null;
        }),
    },
}));

vi.mock('../../models/User', () => ({
    User: {
        findOne: vi.fn(),
    },
}));

import { createApp } from '../../testApp';
import { isSafeFilePath } from '../../middleware/upload';

const app = createApp();

function generateToken(userId: string, name: string = 'Alice') {
    return jwt.sign({ userId, name, role: 'user' }, 'test-secret-for-upload-tests', { expiresIn: '1h' });
}

describe('File Upload Handling (/api/tasks/:taskId/attachments)', () => {
    const userA = 'user-alice-123';
    const userB = 'user-bob-456';
    const taskId = 'task-math-101';

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset in-memory test task
        mockTasksDatabase[taskId] = {
            _id: taskId,
            title: 'Math Assignment',
            userId: userA,
            attachments: [],
        };

        if (!fs.existsSync(TEST_UPLOAD_DIR)) {
            fs.mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
        }
    });

    afterAll(() => {
        // Clean up test uploads directory
        if (fs.existsSync(TEST_UPLOAD_DIR)) {
            fs.rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
        }
    });

    it('uploads a valid file and generates a safe server-side filename', async () => {
        const token = generateToken(userA);

        const res = await request(app)
            .post(`/api/tasks/${taskId}/attachments`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from('# Study Notes for Exam'), 'notes.md');

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.originalName).toBe('notes.md');
        expect(res.body.filename).toMatch(/^[0-9a-f-]+\.md$/i); // Generated UUID + ext
        expect(res.body.filename).not.toBe('notes.md'); // Original name never used as filesystem path
        expect(res.body.mimeType).toBe('text/markdown');
    });

    it('rejects forbidden/dangerous file types (.exe, .sh, .js) with 400', async () => {
        const token = generateToken(userA);

        const res = await request(app)
            .post(`/api/tasks/${taskId}/attachments`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', Buffer.from('echo malicious'), 'exploit.sh');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/invalid file type/i);
    });

    it('rejects oversized files exceeding 5MB strict limit with 400', async () => {
        const token = generateToken(userA);
        const oversizedBuffer = Buffer.alloc(5.5 * 1024 * 1024); // 5.5MB

        const res = await request(app)
            .post(`/api/tasks/${taskId}/attachments`)
            .set('Authorization', `Bearer ${token}`)
            .attach('file', oversizedBuffer, 'huge_document.pdf');

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/strict 5MB size limit/i);
    });

    it('returns 400 when no file is provided in the multipart request', async () => {
        const token = generateToken(userA);

        const res = await request(app)
            .post(`/api/tasks/${taskId}/attachments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no file uploaded/i);
    });

    it('prevents unauthorized users (User B) from attaching files to User A task', async () => {
        const bobToken = generateToken(userB, 'Bob');

        const res = await request(app)
            .post(`/api/tasks/${taskId}/attachments`)
            .set('Authorization', `Bearer ${bobToken}`)
            .attach('file', Buffer.from('Hello'), 'notes.txt');

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/task not found/i);
    });

    it('prevents path traversal attempts outside upload directory', () => {
        const baseDir = path.resolve('/var/app/uploads');
        const traversalPath = path.resolve('/var/app/uploads/../../etc/passwd');
        const safePath = path.resolve('/var/app/uploads/123e4567-e89b-12d3-a456-426614174000.pdf');

        expect(isSafeFilePath(baseDir, traversalPath)).toBe(false);
        expect(isSafeFilePath(baseDir, safePath)).toBe(true);
    });
});

