/**
 * Integration tests: MongoDB Aggregation Pipeline (/api/tasks/stats)
 *
 * Exercises the multi-stage MongoDB aggregation pipeline:
 * - $match (tenant isolation)
 * - $facet (parallel analytical sub-pipelines)
 * - $group (status and priority grouping, summary accumulators)
 * - $project (field extraction and computed arithmetic metrics like completion rate)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

vi.mock('../../models/Task', () => ({
    Task: {
        find: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        findOneAndDelete: vi.fn(),
        aggregate: vi.fn(),
    },
}));

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

function makeJwt(userId = '65f1a2b3c4d5e6f7a8b9c0d1', name = 'Test User') {
    return jwt.sign(
        { userId, name },
        'test-secret-for-integration-tests',
        { expiresIn: '5m' }
    );
}

describe('MongoDB Aggregation Pipeline: GET /api/tasks/stats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects unauthenticated requests with 401', async () => {
        const res = await request(app).get('/api/tasks/stats');
        expect(res.status).toBe(401);
    });

    it('executes aggregation pipeline and returns multi-stage metrics', async () => {
        const userId = '65f1a2b3c4d5e6f7a8b9c0d1';
        const mockAggregationResult = [
            {
                byStatus: [
                    { _id: 'completed', count: 4 },
                    { _id: 'pending', count: 2 },
                ],
                byPriority: [
                    { _id: 'high', count: 3 },
                    { _id: 'medium', count: 2 },
                    { _id: 'low', count: 1 },
                ],
                overview: [
                    {
                        totalTasks: 6,
                        completedTasks: 4,
                        pendingTasks: 2,
                        totalAttachments: 3,
                        totalAttachmentBytes: 154200,
                        completionRate: 66.7,
                    },
                ],
            },
        ];

        vi.mocked(Task.aggregate).mockResolvedValueOnce(mockAggregationResult);

        const res = await request(app)
            .get('/api/tasks/stats')
            .set('Authorization', `Bearer ${makeJwt(userId)}`);

        expect(res.status).toBe(200);
        expect(Task.aggregate).toHaveBeenCalledTimes(1);

        // Verify pipeline stages were passed to aggregate
        const pipelineArg = vi.mocked(Task.aggregate).mock.calls[0][0];
        expect(Array.isArray(pipelineArg)).toBe(true);

        // Verify Stage 1 is $match scoping to the authenticated user
        expect(pipelineArg[0]).toHaveProperty('$match');
        expect((pipelineArg[0] as any).$match.userId.toString()).toBe(userId);

        // Verify Stage 2 is $facet with sub-pipelines
        expect(pipelineArg[1]).toHaveProperty('$facet');
        expect((pipelineArg[1] as any).$facet).toHaveProperty('byStatus');
        expect((pipelineArg[1] as any).$facet).toHaveProperty('byPriority');
        expect((pipelineArg[1] as any).$facet).toHaveProperty('overview');

        // Verify response structure
        expect(res.body).toHaveProperty('overview');
        expect(res.body.overview.totalTasks).toBe(6);
        expect(res.body.overview.completedTasks).toBe(4);
        expect(res.body.overview.pendingTasks).toBe(2);
        expect(res.body.overview.completionRate).toBe(66.7);
        expect(res.body.overview.totalAttachments).toBe(3);
        expect(res.body.overview.totalAttachmentBytes).toBe(154200);

        expect(res.body.byStatus).toEqual([
            { _id: 'completed', count: 4 },
            { _id: 'pending', count: 2 },
        ]);
        expect(res.body.byPriority).toEqual([
            { _id: 'high', count: 3 },
            { _id: 'medium', count: 2 },
            { _id: 'low', count: 1 },
        ]);
    });

    it('returns sensible defaults (zeroes) when user has 0 tasks', async () => {
        const userId = '65f1a2b3c4d5e6f7a8b9c0d2';
        const emptyAggregationResult = [
            {
                byStatus: [],
                byPriority: [],
                overview: [],
            },
        ];

        vi.mocked(Task.aggregate).mockResolvedValueOnce(emptyAggregationResult);

        const res = await request(app)
            .get('/api/tasks/stats')
            .set('Authorization', `Bearer ${makeJwt(userId)}`);

        expect(res.status).toBe(200);
        expect(res.body.overview).toEqual({
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            totalAttachments: 0,
            totalAttachmentBytes: 0,
            completionRate: 0,
        });
        expect(res.body.byStatus).toEqual([]);
        expect(res.body.byPriority).toEqual([]);
    });

    it('handles aggregation errors with 500', async () => {
        vi.mocked(Task.aggregate).mockRejectedValueOnce(new Error('Mongo aggregate timeout'));

        const res = await request(app)
            .get('/api/tasks/stats')
            .set('Authorization', `Bearer ${makeJwt()}`);

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('error', 'Failed to compute task statistics');
    });
});
