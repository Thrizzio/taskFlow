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

        // The session is saved first so the operational MongoDB record
        // exists before analytics data is written.
        const session = new FocusSession({
            taskId,
            userId,
            duration,
            startedAt,
            endedAt,
            status: 'completed'
        });

        await session.save();

        // These two lookups are independent and could be executed with
        // Promise.all(), but they are kept sequential here for simpler
        // control flow and easier error handling in this small application.
        const task = await Task.findById(taskId);
        const user = await User.findById(userId);

        if (task && user) {
            // These two upserts are also independent and could be executed
            // concurrently with Promise.all(). They remain sequential here
            // to keep the database write sequence explicit.
            await pool.query(`
                INSERT INTO users (id, name) VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, [user._id.toString(), user.name]);

            await pool.query(`
                INSERT INTO tasks (id, title, user_id) VALUES ($1, $2, $3)
                ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
            `, [task._id.toString(), task.title, user._id.toString()]);

            // This depends on the user and task records being available,
            // so it remains after the previous operations.
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