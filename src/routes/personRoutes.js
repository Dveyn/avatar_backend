import express from 'express';
import { getPeople, addPerson, getProfile, getAvatar, getAvatars } from '../controllers/personController.js';
import { authenticateJWT } from '../middleware/middleware.js';
import { validateAddPerson } from '../utils/validation.js';

const router = express.Router();

// Все маршруты требуют аутентификации
router.use(authenticateJWT);

router.get('/', getPeople);
router.get('/profile', getProfile);
router.post('/add', validateAddPerson, addPerson);
router.post('/avatar', getAvatar);
router.post('/avatars', getAvatars);

export default router;
