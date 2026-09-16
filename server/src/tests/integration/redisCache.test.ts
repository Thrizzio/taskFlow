/**
 * Integration tests: Redis Caching Layer (Cache-Aside Pattern)
 *
 * Verifies:
 * 1. Initial request results in a Cache MISS (queried from PostgreSQL analytics store)
 *    and sets the X-Cache: MISS response header.
 * 2. Subsequent request results in a Cache HIT (served directly from Redis memory)
 *    and sets the X-Cache: HIT response header, avoiding redundant database roundtrips.
 * 3. Cache Invalidation: Creating a new focus session purges the user's cached analytics,
 *    ensuring cache consistency.
 * 4. Offline / Failure Resilience: If Redis is unavailable or throws, requests gracefully
 *    fall back to direct database queries without crashing or returning 500.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import path from 'path';

const mockAnalyticsDbQuery = vi.fn();

vi.mock('../../db/queries/analyticsQueries', () => ({
    getTimeSpentPerUserPerTaskPrisma: (...args: any[]) => mockAnalyticsDbQuery(...args),
    getTimeSpentPerUserPerTask: (...args: any[]) => mockAnalyticsDbQuery(...args),
}));

vi.mock('../../models/FocusSession', () => {
    const mockSave = vi.fn().mockResolvedValue({ _id: 'session-123' });
    const MockFocusSession = vi.fn().mockImplementation(function (this: any, data: any) {
        Object.assign(this, data);
        this.save = mockSave;
    });
    return { FocusSession: MockFocusSession };
});

vi.mock('../../models/Task', () => ({
    Task: {
        findById: vi.fn().mockResolvedValue({
            _id: 'task-456',
            title: 'Design System Documentation',
        }),
    },
}));

vi.mock('../../models/User', () => ({
    User: {
        findById: vi.fn().mockResolvedValue({
            _id: 'user-123',
            name: 'Test Engineer',
        }),
    },
}));

vi.mock('../../controllers/sessionController', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../controllers/sessionController')>();
    return {
        ...actual,
        persistAnalyticsSessionTx: vi.fn().mockResolvedValue({ id: 'tx-done' }),
    };
});

vi.mock('../../utils/config', () => ({
    default: {
        JWT_SECRET: 'test-secret-for-redis-tests',
        REDIS_URL: 'redis://localhost:6379',
        REDIS_CACHE_TTL: 300,
        UPLOAD_DIR: path.resolve(__dirname, '../../../uploads'),
        MONGODB_URI: 'mongodb://localhost/test',
        POSTGRES_DATABASE_URL: 'postgres://localhost/test',
        PORT: 4001,
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';
import { setRedisClientForTesting } from '../../utils/redis';

describe('Redis Analytics Caching (Cache-Aside Pattern)', () => {
    const app = createApp();
    const userId = 'user-123';
    const token = jwt.sign(
        { userId, name: 'Test Engineer', role: 'user' },
        'test-secret-for-redis-tests',
        { expiresIn: '1h' }
    );

    const mockDbData = [
        { userName: 'Test Engineer', taskTitle: 'Setup Redis Cache', totalSeconds: 1500 },
        { userName: 'Test Engineer', taskTitle: 'Dockerize Frontend', totalSeconds: 2400 },
    ];

    let store: Map<string, string>;
    let mockRedis: any;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new Map<string, string>();

        mockRedis = {
            get: vi.fn(async (key: string) => store.get(key) || null),
            setex: vi.fn(async (key: string, _ttl: number, val: string) => {
                store.set(key, val);
                return 'OK';
            }),
            keys: vi.fn(async (pattern: string) => {
                const prefix = pattern.replace('*', '');
                return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
            }),
            del: vi.fn(async (...keys: string[]) => {
                for (const k of keys) store.delete(k);
                return keys.length;
            }),
        };

        setRedisClientForTesting(mockRedis, true);
        mockAnalyticsDbQuery.mockResolvedValue(mockDbData);
    });

    it('returns X-Cache: MISS on cold cache, executes DB query, and populates Redis', async () => {
        const res = await request(app)
            .get('/api/analytics/time-by-task')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.headers['x-cache']).toBe('MISS');
        expect(res.body).toEqual(mockDbData);
        expect(mockAnalyticsDbQuery).toHaveBeenCalledTimes(1);

        // Verify key was written to Redis store
        const expectedKey = `analytics:user:${userId}:time-by-task`;
        expect(mockRedis.setex).toHaveBeenCalledWith(expectedKey, 300, JSON.stringify(mockDbData));
        expect(store.has(expectedKey)).toBe(true);
    });

    it('returns X-Cache: HIT on warm cache directly from Redis without calling DB query', async () => {
        // Pre-populate cache
        const cacheKey = `analytics:user:${userId}:time-by-task`;
        store.set(cacheKey, JSON.stringify(mockDbData));

        const res = await request(app)
            .get('/api/analytics/time-by-task')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.headers['x-cache']).toBe('HIT');
        expect(res.body).toEqual(mockDbData);
        expect(mockAnalyticsDbQuery).not.toHaveBeenCalled();
        expect(mockRedis.get).toHaveBeenCalledWith(cacheKey);
    });

    it('invalidates user analytics cache when a new focus session is saved', async () => {
        // Warm the cache first
        const cacheKey = `analytics:user:${userId}:time-by-task`;
        store.set(cacheKey, JSON.stringify(mockDbData));
        expect(store.has(cacheKey)).toBe(true);

        // Post new focus session
        const sessionRes = await request(app)
            .post('/api/focus-sessions')
            .set('Authorization', `Bearer ${token}`)
            .send({
                taskId: 'task-456',
                duration: 1800,
                startedAt: new Date(Date.now() - 1800000).toISOString(),
                endedAt: new Date().toISOString(),
            });

        expect(sessionRes.status).toBe(201);
        expect(mockRedis.keys).toHaveBeenCalledWith(`analytics:user:${userId}:*`);
        expect(store.has(cacheKey)).toBe(false);

        // Next analytics request must be a MISS and re-query DB
        const nextRes = await request(app)
            .get('/api/analytics/time-by-task')
            .set('Authorization', `Bearer ${token}`);

        expect(nextRes.status).toBe(200);
        expect(nextRes.headers['x-cache']).toBe('MISS');
        expect(mockAnalyticsDbQuery).toHaveBeenCalledTimes(1);
    });

    it('falls back to database gracefully when Redis is disconnected or offline', async () => {
        // Disconnect Redis
        setRedisClientForTesting(null, false);

        const res = await request(app)
            .get('/api/analytics/time-by-task')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.headers['x-cache']).toBe('MISS');
        expect(res.body).toEqual(mockDbData);
        expect(mockAnalyticsDbQuery).toHaveBeenCalledTimes(1);
    });

    it('falls back to database gracefully when Redis get throws an error', async () => {
        mockRedis.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

        const res = await request(app)
            .get('/api/analytics/time-by-task')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.headers['x-cache']).toBe('MISS');
        expect(res.body).toEqual(mockDbData);
        expect(mockAnalyticsDbQuery).toHaveBeenCalledTimes(1);
    });
});
