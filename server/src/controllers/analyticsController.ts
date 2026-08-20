import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getTimeSpentPerUserPerTask } from '../db/queries/analyticsQueries';

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!.userId;
        const data = await getTimeSpentPerUserPerTask(userId);
        res.json(data);
    } catch (error) {
        console.error('getAnalytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};
