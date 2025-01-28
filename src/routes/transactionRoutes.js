import express from 'express';
import { createTransaction, notificationTransaction } from '../controllers/transactionController.js';

const router = express.Router();

router.post('/create', createTransaction);
router.post('/notification', notificationTransaction);

export default router;
