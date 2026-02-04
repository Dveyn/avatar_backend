// Валидация переменных окружения при старте
import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_DATABASE',
  'JWT_SECRET',
  'JWT_EXPIRATION'
];

export const validateEnv = () => {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    throw new Error(
      `Отсутствуют обязательные переменные окружения: ${missing.join(', ')}`
    );
  }
  
  // Проверка формата JWT_EXPIRATION
  if (process.env.JWT_EXPIRATION && !/^\d+[smhd]$/.test(process.env.JWT_EXPIRATION)) {
    throw new Error('JWT_EXPIRATION должен быть в формате: число + единица времени (например, 1h, 24h, 7d)');
  }
  
  return true;
};
