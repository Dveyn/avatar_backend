import express from 'express';
import { register, confirmEmail, setPassword, login, forgot, checkSession, refreshTokens } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.get('/confirm-email/:token', confirmEmail);
router.post('/set-password', setPassword);
router.post('/login', login);
router.post('/forgot', forgot);
router.get('/valid-token', checkSession);
router.post('/refresh-token', refreshTokens);
export default router;
