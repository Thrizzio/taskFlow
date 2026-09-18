import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { getTimeSpentPerUserPerTask, getTimeSpentPerUserPerTaskPrisma } from '../db/queries/analyticsQueries';
import { getCachedJson, setCachedJson } from '../utils/redis';
import config from '../utils/config';

export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.userId || '';
        const cacheKey = `analytics:user:${userId}:time-by-task`;

        // 1. Check Redis Cache (Cache-Aside pattern)
        const cached = await getCachedJson<any[]>(cacheKey);
        if (cached !== null) {
            res.setHeader('X-Cache', 'HIT');
            res.json(cached);
            return;
        }

        // 2. Query Postgres Analytics Store via Prisma ORM (fallback to raw PG if needed)
        let data: any[];
        try {
            data = await getTimeSpentPerUserPerTaskPrisma(userId);
        } catch {
            data = await getTimeSpentPerUserPerTask(userId);
        }

        // 3. Populate Redis Cache with configured TTL
        await setCachedJson(cacheKey, data, config.REDIS_CACHE_TTL);

        res.setHeader('X-Cache', 'MISS');
        res.json(data);
    } catch (error) {
        console.error('getAnalytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
};

