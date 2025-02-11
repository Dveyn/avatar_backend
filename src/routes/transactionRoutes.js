import express from 'express';
import { createTransaction, notificationTransaction, robokassaSignature } from '../controllers/transactionController.js';

const router = express.Router();

router.post('/create', createTransaction);
router.post('/notification', notificationTransaction);
router.post('/robokassa-signature', robokassaSignature);

export default router;
