import express from 'express';
import { register, confirmEmail, setPassword, login, forgot, checkSession, refreshTokens } from '../controllers/authController.js';
import { vkAuth, telegramAuth, vkCallback } from '../controllers/socialAuthController.js';
import { validateRegister, validateLogin, validateForgot, validateSetPassword } from '../utils/validation.js';
import { authLimiter } from '../middleware/security.js';

const router = express.Router();

// Применяем rate limiting для аутентификации
router.use(authLimiter);

router.post('/register', validateRegister, register);
router.get('/confirm-email/:token', confirmEmail);
router.post('/set-password', validateSetPassword, setPassword);
router.post('/login', validateLogin, login);
router.post('/forgot', validateForgot, forgot);
router.get('/valid-token', checkSession);
router.post('/refresh-token', refreshTokens);

// Social authentication routes
router.post('/vk', vkAuth);
router.get('/vk/callback', vkCallback);
router.post('/telegram', telegramAuth);

export default router;
