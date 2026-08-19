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

export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/api/auth', authRoutes);
    app.use('/api/tasks', taskRoutes);
    app.use('/api/agent', agentRoutes);

    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    return app;
}
