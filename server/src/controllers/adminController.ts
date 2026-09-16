import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Task } from '../models/Task';
import { FocusSession } from '../models/FocusSession';

/**
 * Admin-only operation: System overview metrics.
 */
export const getAdminOverview = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const [totalUsers, totalTasks, totalSessions] = await Promise.all([
            User.countDocuments(),
            Task.countDocuments(),
            FocusSession.countDocuments(),
        ]);

        res.status(200).json({
            system: 'TaskFlow',
            metrics: {
                totalUsers,
                totalTasks,
                totalSessions,
            },
            timestamp: new Date(),
        });
    } catch (error) {
        console.error('getAdminOverview error:', error);
        res.status(500).json({ error: 'Failed to fetch admin overview' });
    }
};

/**
 * Admin-only operation: List all users across the system.
 */
export const getAllUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
        const users = await User.find({}, 'name email role authProvider createdAt').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error('getAllUsers error:', error);
        res.status(500).json({ error: 'Failed to fetch users list' });
    }
};

