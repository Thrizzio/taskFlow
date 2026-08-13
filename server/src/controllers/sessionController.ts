import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { FocusSession } from '../models/FocusSession';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { pool } from '../db/pg';

export const createFocusSession = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { taskId, duration, startedAt, endedAt } = req.body;
        const userId = req.user?.userId;

        if (!taskId || duration === undefined || !startedAt || !endedAt) {
            res.status(400).json({ error: 'Missing required session parameters' });
            return;
        }

        // 1. Save to MongoDB
        const session = new FocusSession({
            taskId,
            userId,
            duration,
            startedAt,
            endedAt,
            status: 'completed'
        });
        await session.save();

        // 2. Write Analytics to PostgreSQL
        const task = await Task.findById(taskId);
        const user = await User.findById(userId);

        if (task && user) {
            // Upsert user
            await pool.query(`
        INSERT INTO users (id, name) VALUES ($1, $2)
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
      `, [user._id.toString(), user.name]);

            // Upsert task
            await pool.query(`
        INSERT INTO tasks (id, title, user_id) VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
      `, [task._id.toString(), task.title, user._id.toString()]);

            // Insert analytics session
            await pool.query(`
        INSERT INTO analytics_sessions (task_id, user_id, duration, started_at, ended_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [task._id.toString(), user._id.toString(), duration, startedAt, endedAt]);
        }

        res.status(201).json(session);
    } catch (error) {
        console.error('createFocusSession error:', error);
        res.status(500).json({ error: 'Failed to create focus session' });
    }
};
