import { Router } from 'express';
import { register, login, googleAuthUrl, googleCallback } from '../controllers/authController';
import { validate, registerSchema, loginSchema } from '../middleware/validate';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// OAuth 2.0 routes
router.get('/google/url', googleAuthUrl);
router.post('/google/callback', googleCallback);
router.get('/google/callback', googleCallback);

export default router;

