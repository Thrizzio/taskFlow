import { Router } from 'express';
import { getAnalytics } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.get('/time-by-task', getAnalytics);

export default router;
