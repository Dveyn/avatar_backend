import express from 'express';
import { createTransaction, notificationTransaction, robokassaSignature, notificationTransactionTest } from '../controllers/transactionController.js';

const router = express.Router();

router.post('/create', createTransaction);
router.post('/notification', notificationTransaction);
router.get('/notification_test', notificationTransactionTest);
router.post('/robokassa-signature', robokassaSignature);

export default router;
