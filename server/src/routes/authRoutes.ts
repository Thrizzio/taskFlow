import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { validate, registerSchema, loginSchema } from '../middleware/validate';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

export default router;

