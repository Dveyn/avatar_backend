import express from 'express';
import { getAvatar, getPeoples, getUsers, savePeople, saveUsers, setAll, setPreview, sendMailCustom } from '../controllers/adminController.js';

const router = express.Router();

router.get('/get_users', getUsers);
router.post('/get_peoples', getPeoples);
router.post('/get_avatar', getAvatar);

router.post('/set_preview', setPreview);
router.post('/set_all', setAll);
 
router.get('/send_mail', sendMailCustom);

export default router;

