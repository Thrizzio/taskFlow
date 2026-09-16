import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/role';
import { getAdminOverview, getAllUsers } from '../controllers/adminController';

const router = Router();

// Enforce both authentication and admin authorization across all admin routes
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/overview', getAdminOverview);
router.get('/users', getAllUsers);

export default router;
