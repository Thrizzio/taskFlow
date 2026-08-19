/**
 * Integration tests: Auth routes
 *
 * These tests exercise the real HTTP layer (Express routes → middleware → controller)
 * using supertest, without starting a server or connecting to a real database.
 *
 * The Mongoose User model is mocked so no MongoDB connection is needed.
 *
 * Demonstrates the difference from unit tests:
 *   - Unit tests call functions directly in isolation.
 *   - Integration tests send real HTTP requests through the full route/middleware stack.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── Mock the User model before importing the app ──────────────────────────────
// This prevents mongoose from trying to connect to MongoDB during tests.
vi.mock('../../models/User', () => ({
    User: {
        findOne: vi.fn(),
        prototype: { save: vi.fn() },
    },
}));

// Also mock config so validateEnv does not call process.exit
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
import { User } from '../../models/User';

const app = createApp();

// ── Helper to build a mock User-like object ───────────────────────────────────
function mockUser(overrides: Record<string, unknown> = {}) {
    return {
        _id: '64a1b2c3d4e5f6a7b8c9d0e1',
        email: 'alice@example.com',
        name: 'Alice',
        passwordHash: '$2b$10$hashedpassword',
        save: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 400 when email is missing', async () => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'Alice',
            password: 'secret123',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    it('returns 400 when name is missing', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'alice@example.com',
            password: 'secret123',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/name/i);
    });

    it('returns 400 when password is shorter than 6 characters', async () => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'abc',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/password/i);
    });

    it('returns 400 when email format is invalid', async () => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'Alice',
            email: 'not-an-email',
            password: 'secret123',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    it('proceeds to controller when validation passes (mocked DB)', async () => {
        // Controller will call User.findOne (returns null = email free)
        // then new User(...).save() — we mock the constructor via prototype
        const mockUserInstance = mockUser();
        (User.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        // Mock User as a class so `new User(...)` works
        const UserMock = User as unknown as new (...args: unknown[]) => typeof mockUserInstance;
        vi.spyOn(UserMock.prototype as unknown as typeof mockUserInstance, 'save').mockResolvedValue(mockUserInstance as never);

        // The actual call may 500 if bcrypt/jwt fail without real deps;
        // what matters is that validation does NOT block this request (no 400).
        const res = await request(app).post('/api/auth/register').send({
            name: 'Alice',
            email: 'alice@example.com',
            password: 'secret123',
        });
        expect(res.status).not.toBe(400);
    });
});

describe('POST /api/auth/login', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns 400 when email is missing', async () => {
        const res = await request(app).post('/api/auth/login').send({ password: 'secret123' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/email/i);
    });

    it('returns 400 when password is missing', async () => {
        const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/password/i);
    });

    it('returns 401 when credentials are invalid (user not found, mocked)', async () => {
        (User.findOne as ReturnType<typeof vi.fn>).mockResolvedValue(null);
        const res = await request(app).post('/api/auth/login').send({
            email: 'nobody@example.com',
            password: 'wrongpass',
        });
        expect(res.status).toBe(401);
    });
});

describe('GET /api/health', () => {
    it('returns ok without authentication', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });
});

describe('Authentication middleware', () => {
    it('returns 401 when no token is provided to a protected route', async () => {
        const res = await request(app).get('/api/tasks');
        expect(res.status).toBe(401);
    });

    it('returns 401 when an invalid token is provided', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', 'Bearer INVALID_TOKEN');
        expect(res.status).toBe(401);
    });

    it('allows access with a valid token', async () => {
        // Sign a token with the same secret used in the mock config
        const token = jwt.sign(
            { userId: 'abc123', name: 'Alice' },
            'test-secret-for-integration-tests',
            { expiresIn: '1m' },
        );

        // Task.find will be called — mock it in tasks.test.ts covers this;
        // here we just check the auth middleware passes (no 401)
        const res = await request(app)
            .get('/api/tasks')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).not.toBe(401);
    });
});
