import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config, { validateEnv } from './utils/config';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import sessionRoutes from './routes/sessionRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import agentRoutes from './routes/agentRoutes';
import adminRoutes from './routes/adminRoutes';
import { initPgDB } from './db/pg';
import { sanitizeRequest } from './middleware/sanitize';
import { startScheduler } from './jobs/scheduler';
validateEnv();

const app = express();
app.use(cors());
app.use(express.json());
app.use(sanitizeRequest);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/focus-sessions', sessionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/admin', adminRoutes);

// Add simple health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Boot wrapper using async/await naturally
const startServer = async () => {
    try {
        await mongoose.connect(config.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        // Initialize PG for analytics schema support
        await initPgDB();

        app.listen(config.PORT, () => {
            console.log(`Server running on port ${config.PORT}`);
            startScheduler();
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
