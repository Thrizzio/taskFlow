import { Router } from 'express';
import { createFocusSession } from '../controllers/sessionController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.post('/', createFocusSession);

export default router;
