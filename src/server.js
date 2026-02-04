import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import personRoutes from './routes/personRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { errorHandler, notFoundHandler } from './utils/errors.js';
import { validateEnv } from './utils/env.js';
import { logger } from './utils/logger.js';
import { apiLimiter, securityHeaders } from './middleware/security.js';

// Валидация переменных окружения при старте
try {
  validateEnv();
} catch (error) {
  logger.error('Ошибка валидации переменных окружения', { error: error.message });
  process.exit(1);
}

const allowedOrigins = [
  'http://localhost:3000',
  'https://localhost',
  'http://test.ananievds.ru',
  'https://test.ananievds.ru',
  'https://avalik-avatar.ru',
  'http://avalik-avatar.ru'
];

const app = express();

// Security headers
app.use(securityHeaders);

// CORS configuration
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

// Body parsing middleware с лимитами
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Rate limiting для всех API
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/pay', transactionRoutes);
app.use('/api/user', personRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (должен быть последним)
app.use(errorHandler);

const PORT = process.env.PORT || 3102;

app.listen(PORT, () => {
  logger.info(`Сервер запущен на порту ${PORT}`, { 
    env: process.env.NODE_ENV || 'development' 
  });
});
