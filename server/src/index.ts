import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config, { validateEnv } from './utils/config';
import authRoutes from './routes/authRoutes';
import taskRoutes from './routes/taskRoutes';
import sessionRoutes from './routes/sessionRoutes';
import { initPgDB } from './db/pg';
validateEnv();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/focus-sessions', sessionRoutes);

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
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();
