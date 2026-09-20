/**
 * testApp.ts — creates an Express app without starting the server
 *
 * Integration tests import this function rather than src/index.ts so that
 * no database connection is established and no HTTP server is bound to a port.
 *
 * The app is fully configured (CORS, JSON parsing, all routes) so that
 * supertest can exercise the real middleware + controller stack.
 *
 * Unit tests          → isolated functions, no Express
 * Integration tests   → this app + supertest, mocked DB models
 */

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import agentRoutes from './routes/agentRoutes';
import adminRoutes from './routes/adminRoutes';
import sessionRoutes from './routes/sessionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import paymentRoutes from './routes/paymentRoutes';
import ssrRoutes from './routes/ssrRoutes';
import { sanitizeRequest } from './middleware/sanitize';

export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(sanitizeRequest);

    app.use('/', ssrRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/tasks', taskRoutes);
    app.use('/api/focus-sessions', sessionRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/agent', agentRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/payment', paymentRoutes);

    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    return app;
}
