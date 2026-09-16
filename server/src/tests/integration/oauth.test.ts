import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const { MockUserModel } = vi.hoisted(() => {
    class MockUserModel {
        _id = 'mock-user-id-123';
        name = '';
        email = '';
        googleId = '';
        authProvider = 'google';
        role = 'user';

        constructor(data: any = {}) {
            Object.assign(this, data);
        }

        save = vi.fn().mockResolvedValue(this);
        static findOne = vi.fn();
    }
    return { MockUserModel };
});

vi.mock('../../models/User', () => ({
    User: MockUserModel,
}));

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-oauth-tests',
        GOOGLE_CLIENT_ID: 'mock-google-client-id',
        GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
        GOOGLE_CALLBACK_URL: 'http://localhost:5000/api/auth/google/callback',
        PORT: 4001,
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';
import { User } from '../../models/User';

const app = createApp();

describe('OAuth Authentication (/api/auth/google)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/auth/google/url', () => {
        it('returns a valid Google OAuth consent URL', async () => {
            const res = await request(app).get('/api/auth/google/url');
            expect(res.status).toBe(200);
            expect(res.body.url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
            expect(res.body.url).toContain('client_id=mock-google-client-id');
        });
    });

    describe('POST /api/auth/google/callback', () => {
        it('returns 400 when authorization code is missing', async () => {
            const res = await request(app)
                .post('/api/auth/google/callback')
                .send({});
            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/code is required/i);
        });

        it('creates a new user and issues a JWT for a new OAuth account', async () => {
            (User.findOne as any).mockResolvedValue(null);

            const res = await request(app)
                .post('/api/auth/google/callback')
                .send({ code: 'mock_code_newstudent' });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body.user).toHaveProperty('email', 'newstudent@gmail.com');
            expect(res.body.user).toHaveProperty('role', 'user');

            // Verify JWT validity
            const decoded = jwt.verify(res.body.token, 'test-secret-for-oauth-tests') as any;
            expect(decoded.name).toBe('Newstudent');
            expect(decoded.role).toBe('user');
        });

        it('logs in an existing user and returns a valid JWT without duplicate registration', async () => {
            const existingUser = new MockUserModel({
                _id: '64a1b2c3d4e5f6a7b8c9d0e2',
                email: 'existingstudent@gmail.com',
                name: 'Existing Student',
                googleId: 'google_id_existingstudent',
                role: 'user',
            });
            (User.findOne as any).mockResolvedValue(existingUser);

            const res = await request(app)
                .post('/api/auth/google/callback')
                .send({ code: 'mock_code_existingstudent' });

            expect(res.status).toBe(200);
            expect(res.body.token).toBeDefined();
            expect(res.body.user.email).toBe('existingstudent@gmail.com');

            const decoded = jwt.verify(res.body.token, 'test-secret-for-oauth-tests') as any;
            expect(decoded.userId).toBe(existingUser._id);
        });

        it('handles failed OAuth callback gracefully when token exchange fails', async () => {
            const res = await request(app)
                .post('/api/auth/google/callback')
                .send({ code: 'invalid_foreign_code' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBeDefined();
        });
    });
});
