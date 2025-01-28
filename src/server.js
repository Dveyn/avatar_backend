import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import personRoutes from './routes/personRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import cors from 'cors';

const allowedOrigins = [
  'http://localhost:3000',
  'http://test.ananievds.ru',
  'https://test.ananievds.ru',
  'https://avalik-avatar.ru',
  'http://avalik-avatar.ru'
];


const app = express();
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true, 
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/pay', transactionRoutes);
app.use('/api/user', personRoutes);

app.use('/api/admin', adminRoutes);

app.listen(3102, () => {
  console.log('Server is running on port 3001');
});
