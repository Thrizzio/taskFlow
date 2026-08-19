import express from 'express';
import { handleProductivityAgent } from '../controllers/agentController';
import { authenticate } from '../middleware/auth';
import { validate, agentRequestSchema } from '../middleware/validate';

const router = express.Router();

// POST /api/agent/productivity
router.post('/productivity', authenticate, validate(agentRequestSchema), handleProductivityAgent);

export default router;

