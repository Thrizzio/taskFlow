/**
 * Integration tests: Server-Side Rendering (/ssr-demo)
 *
 * Validates:
 * 1. GET /ssr-demo returns HTTP 200 with Content-Type: text/html
 * 2. Full HTML5 semantic document (doctype, head, meta tags, title)
 * 3. Server-rendered React component markup via ReactDOMServer.renderToString
 * 4. Correct interpolation of task telemetry metrics into the initial HTML payload
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../models/Task', () => ({
    Task: {
        countDocuments: vi.fn(),
        find: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        findOneAndDelete: vi.fn(),
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
        RAZORPAY_KEY_ID: 'rzp_test_mock_key',
        RAZORPAY_KEY_SECRET: 'rzp_test_mock_secret',
    },
    validateEnv: vi.fn(),
}));

import { createApp } from '../../testApp';
import { Task } from '../../models/Task';

const app = createApp();

describe('Server-Side Rendering (SSR): GET /ssr-demo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 200 and Content-Type text/html with a complete HTML document', async () => {
        vi.mocked(Task.countDocuments)
            .mockResolvedValueOnce(18 as any) // totalTasks
            .mockResolvedValueOnce(12 as any); // completedTasks

        const res = await request(app).get('/ssr-demo');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');

        // Document structure
        expect(res.text).toContain('<!DOCTYPE html>');
        expect(res.text).toContain('<html lang="en">');
        expect(res.text).toContain('<meta name="description"');
        expect(res.text).toContain('FocusFlow - Server-Side Rendered Snapshot');
    });

    it('includes ReactDOMServer rendered markup and dynamic metrics directly in initial HTML', async () => {
        vi.mocked(Task.countDocuments)
            .mockResolvedValueOnce(25 as any) // totalTasks
            .mockResolvedValueOnce(15 as any); // completedTasks

        const res = await request(app).get('/ssr-demo');

        expect(res.status).toBe(200);

        // Verify React component was rendered on the server
        expect(res.text).toContain('id="ssr-root"');
        expect(res.text).toContain('FocusFlow — Server-Side Rendered Summary');
        expect(res.text).toContain('⚡ SSR Rendered');
        expect(res.text).toContain('ReactDOMServer.renderToString()');

        // Verify dynamic values in the rendered HTML
        expect(res.text).toContain('id="ssr-total-tasks"');
        expect(res.text).toContain('>25<'); // total
        expect(res.text).toContain('id="ssr-completed-tasks"');
        expect(res.text).toContain('>15<'); // completed
        expect(res.text).toContain('id="ssr-pending-tasks"');
        expect(res.text).toContain('>10<'); // 25 - 15 = 10
    });

    it('falls back gracefully to default telemetry if database count query fails', async () => {
        vi.mocked(Task.countDocuments).mockRejectedValueOnce(new Error('DB unreachable'));

        const res = await request(app).get('/ssr-demo');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        // Confirms fallback numbers render without server crash
        expect(res.text).toContain('id="ssr-total-tasks"');
        expect(res.text).toContain('id="ssr-completed-tasks"');
        expect(res.text).toContain('id="ssr-root"');
    });
});
