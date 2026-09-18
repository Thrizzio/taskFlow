import { Response } from 'express';
import { runProductivityAgent } from '../agent/productivityAgent';
import { AuthRequest } from '../middleware/auth';
import { sanitizeString } from '../utils/sanitize';

export const handleProductivityAgent = async (req: AuthRequest, res: Response) => {
  try {
    const { request } = req.body as { request?: string };
    if (!request) return res.status(400).json({ success: false, error: 'Missing request text' });

    if (!req.user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const sanitizedRequest = sanitizeString(request);
    const result = await runProductivityAgent(sanitizedRequest, req.user.userId);
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('Agent error', err);
    return res.status(500).json({ success: false, error: 'Agent failed' });
  }
};

