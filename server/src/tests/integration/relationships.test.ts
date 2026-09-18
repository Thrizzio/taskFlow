/**
 * Integration tests: MongoDB Embedding vs Referencing Relationships
 *
 * Demonstrates and validates the architectural decision:
 * 1. Embedded Subdocuments: Task.attachments
 *    - Bounded 1-to-few relationship (0 to ~10 files per task).
 *    - Lifecycles are coupled; attachments belong strictly to the task.
 *    - Stored directly inside Task document, retrieved in a single read without $lookup joins.
 *
 * 2. Referenced Entities: Task.userId -> User, FocusSession.taskId -> Task
 *    - Unbounded 1-to-N relationships (users have thousands of tasks, tasks have many sessions).
 *    - Lifecycles are independent. Storing tasks inside User would exceed MongoDB's 16MB limit.
 *    - Normalized foreign keys populated dynamically on demand via Mongoose `.populate()`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

vi.mock('../../models/Task', () => {
    return {
        Task: {
            find: vi.fn(),
            findOne: vi.fn(),
            findOneAndUpdate: vi.fn(),
            findOneAndDelete: vi.fn(),
            aggregate: vi.fn(),
        },
    };
});

vi.mock('../../models/User', () => ({
    User: { findOne: vi.fn() },
}));

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-integration-tests',
        GEMINI_API_KEY: undefined,
        GEMINI_PRICING: { inputPer1kTokens: 0.000075, outputPer1kTokens: 0.000300 },
        MONGODB_URI: 'mongodb://localhost/test',
        POSTGRES_DATABASE_URL: 'postgres://localhost/test',
        PORT: 4001,
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';
import { Task } from '../../models/Task';

const app = createApp();

function makeJwt(userId = '65f1a2b3c4d5e6f7a8b9c0d1', name = 'Alice') {
    return jwt.sign(
        { userId, name },
        'test-secret-for-integration-tests',
        { expiresIn: '5m' }
    );
}

describe('MongoDB Relationships: Embedding vs Referencing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Embedded Subdocuments: Task.attachments', () => {
        it('returns embedded attachments directly inside the task document without secondary queries', async () => {
            const taskId = '65f1a2b3c4d5e6f7a8b9c0aa';
            const userId = '65f1a2b3c4d5e6f7a8b9c0d1';

            const taskWithEmbeddedAttachments = {
                _id: taskId,
                title: 'Review System Architecture',
                userId: userId, // Referenced foreign key
                attachments: [
                    // Embedded subdocuments
                    {
                        id: 'att-uuid-1',
                        originalName: 'system_arch.pdf',
                        filename: 'att-uuid-1.pdf',
                        mimeType: 'application/pdf',
                        size: 20480,
                        uploadedAt: new Date().toISOString(),
                    },
                    {
                        id: 'att-uuid-2',
                        originalName: 'diagram.png',
                        filename: 'att-uuid-2.png',
                        mimeType: 'image/png',
                        size: 10240,
                        uploadedAt: new Date().toISOString(),
                    },
                ],
            };

            // Setup chained query mock
            const mockQuery = {
                populate: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve(taskWithEmbeddedAttachments),
            };
            vi.mocked(Task.findOne).mockReturnValue(mockQuery as any);

            const res = await request(app)
                .get(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${makeJwt(userId)}`);

            expect(res.status).toBe(200);
            expect(Task.findOne).toHaveBeenCalledWith({ _id: taskId, userId });
            // By default without ?populate=user, populate() is NOT called
            expect(mockQuery.populate).not.toHaveBeenCalled();

            // Embedded attachments are directly present in the parent document payload
            expect(res.body.attachments).toHaveLength(2);
            expect(res.body.attachments[0].originalName).toBe('system_arch.pdf');
            expect(res.body.attachments[1].originalName).toBe('diagram.png');
            // Foreign key remains an unpopulated ID reference
            expect(res.body.userId).toBe(userId);
        });
    });

    describe('Referenced Entity Population: Task.userId -> User', () => {
        it('dynamically populates referenced User document when ?populate=user is requested', async () => {
            const taskId = '65f1a2b3c4d5e6f7a8b9c0bb';
            const userId = '65f1a2b3c4d5e6f7a8b9c0d1';

            const taskWithPopulatedUser = {
                _id: taskId,
                title: 'Prepare Final Rubric Demo',
                // Populated referenced User entity
                userId: {
                    _id: userId,
                    name: 'Alice Developer',
                    email: 'alice@example.com',
                    role: 'user',
                },
                attachments: [],
            };

            const mockQuery = {
                populate: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve(taskWithPopulatedUser),
            };
            vi.mocked(Task.findOne).mockReturnValue(mockQuery as any);

            const res = await request(app)
                .get(`/api/tasks/${taskId}?populate=user`)
                .set('Authorization', `Bearer ${makeJwt(userId)}`);

            expect(res.status).toBe(200);
            expect(Task.findOne).toHaveBeenCalledWith({ _id: taskId, userId });
            // Verify populate was called with referenced path and projected safe fields
            expect(mockQuery.populate).toHaveBeenCalledWith('userId', 'name email role');

            // Verify populated entity fields
            expect(res.body.userId).toHaveProperty('name', 'Alice Developer');
            expect(res.body.userId).toHaveProperty('email', 'alice@example.com');
            expect(res.body.userId).toHaveProperty('role', 'user');
        });

        it('returns 404 if the requested task is not found', async () => {
            const mockQuery = {
                populate: vi.fn().mockReturnThis(),
                then: (resolve: any) => resolve(null),
            };
            vi.mocked(Task.findOne).mockReturnValue(mockQuery as any);

            const res = await request(app)
                .get('/api/tasks/non-existent-id')
                .set('Authorization', `Bearer ${makeJwt()}`);

            expect(res.status).toBe(404);
            expect(res.body).toHaveProperty('error', 'Task not found');
        });
    });
});
