import express from 'express';
import { getPeople, addPerson, getProfile, getAvatar, getAvatars } from '../controllers/personController.js';
import { authenticateJWT } from '../middleware/middleware.js';

const router = express.Router();

router.get('/', authenticateJWT, getPeople);
router.get('/profile',authenticateJWT, getProfile)
router.post('/add', authenticateJWT, addPerson);
router.post('/avatar', authenticateJWT, getAvatar);
router.post('/avatars', authenticateJWT, getAvatars);

export default router;
