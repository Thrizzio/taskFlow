import { Router } from 'express';
import {
    createOrder,
    verifyPayment,
    getSubscriptionStatus,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All payment operations require authenticated user context
router.use(authenticate);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.get('/status', getSubscriptionStatus);

export default router;
