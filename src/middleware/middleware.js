import dotenv from 'dotenv';
dotenv.config();

import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../utils/errors.js';
import { asyncHandler } from '../utils/errors.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateJWT = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        throw new AuthenticationError('Токен не предоставлен');
    }

    // Поддерживаем формат "Bearer token" и просто "token"
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AuthenticationError('Токен просрочен');
        } else if (err.name === 'JsonWebTokenError') {
            throw new AuthenticationError('Неверный токен');
        } else {
            throw new AuthenticationError('Ошибка проверки токена');
        }
    }
});
