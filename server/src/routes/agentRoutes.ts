import express from 'express';
import { handleProductivityAgent } from '../controllers/agentController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// POST /api/agent/productivity
router.post('/productivity', authenticate, handleProductivityAgent);

export default router;
