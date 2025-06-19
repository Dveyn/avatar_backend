import express from 'express';
import { register, confirmEmail, setPassword, login, forgot, checkSession, refreshTokens } from '../controllers/authController.js';
import { vkAuth, telegramAuth, vkCallback } from '../controllers/socialAuthController.js';

const router = express.Router();

router.post('/register', register);
router.get('/confirm-email/:token', confirmEmail);
router.post('/set-password', setPassword);
router.post('/login', login);
router.post('/forgot', forgot);
router.get('/valid-token', checkSession);
router.post('/refresh-token', refreshTokens);

// Social authentication routes
router.post('/vk', vkAuth);
router.get('/vk/callback', vkCallback);
router.post('/telegram', telegramAuth);

export default router;
