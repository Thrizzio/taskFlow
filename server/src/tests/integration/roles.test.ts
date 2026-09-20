import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock User, Task, and FocusSession models
vi.mock('../../models/User', () => ({
    User: {
        countDocuments: vi.fn().mockResolvedValue(42),
        find: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([
                { name: 'Alice', email: 'alice@example.com', role: 'admin' },
                { name: 'Bob', email: 'bob@example.com', role: 'user' },
            ]),
        }),
    },
}));

vi.mock('../../models/Task', () => ({
    Task: {
        countDocuments: vi.fn().mockResolvedValue(150),
        find: vi.fn().mockReturnValue({
            sort: vi.fn().mockResolvedValue([]),
        }),
    },
}));

vi.mock('../../models/FocusSession', () => ({
    FocusSession: {
        countDocuments: vi.fn().mockResolvedValue(300),
    },
}));

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-role-tests',
        PORT: 4001,
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';

const app = createApp();

function generateToken(userId: string, name: string, role: 'user' | 'admin') {
    return jwt.sign({ userId, name, role }, 'test-secret-for-role-tests', { expiresIn: '1h' });
}

describe('Role-Based Access Control (RBAC)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Authentication vs Authorization boundary', () => {
        it('returns 401 Unauthorized when unauthenticated (no token)', async () => {
            const res = await request(app).get('/api/admin/overview');
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/missing token/i);
        });

        it('returns 401 Unauthorized when token signature is invalid', async () => {
            const res = await request(app)
                .get('/api/admin/overview')
                .set('Authorization', 'Bearer invalid.token.value');
            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/invalid token/i);
        });

        it('returns 403 Forbidden when normal user attempts to access admin endpoint', async () => {
            const userToken = generateToken('user-1', 'Normal Bob', 'user');

            const res = await request(app)
                .get('/api/admin/overview')
                .set('Authorization', `Bearer ${userToken}`);

            // Authenticated (not 401), but forbidden (403)
            expect(res.status).toBe(403);
            expect(res.body.error).toMatch(/insufficient permissions/i);
        });

        it('returns 403 Forbidden when normal user attempts to list all users', async () => {
            const userToken = generateToken('user-1', 'Normal Bob', 'user');

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${userToken}`);

            expect(res.status).toBe(403);
        });

        it('allows normal user to access standard user endpoints', async () => {
            const userToken = generateToken('user-1', 'Normal Bob', 'user');

            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${userToken}`);

            // Should succeed or proceed past auth/role checks (not 401/403)
            expect(res.status).toBe(200);
        });

        it('allows admin user to access admin overview metrics (200 OK)', async () => {
            const adminToken = generateToken('admin-99', 'Admin Alice', 'admin');

            const res = await request(app)
                .get('/api/admin/overview')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('metrics');
            expect(res.body.metrics).toEqual({
                totalUsers: 42,
                totalTasks: 150,
                totalSessions: 300,
            });
        });

        it('allows admin user to access user management endpoint (200 OK)', async () => {
            const adminToken = generateToken('admin-99', 'Admin Alice', 'admin');

            const res = await request(app)
                .get('/api/admin/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(2);
            expect(res.body[0].email).toBe('alice@example.com');
        });
    });
});

