import dotenv from 'dotenv';
dotenv.config();

import { query } from '../models/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendConfirmationEmail } from '../utils/email.js';
import { v4 as uuidv4 } from 'uuid';
import hasher from 'wordpress-hash-node';
import crypto from 'crypto';
import { asyncHandler, AuthenticationError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { insertAvatarsBatch } from '../utils/dbHelpers.js';
import { notifyViaTelegramBot } from '../utils/telegramBotClient.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = '30d'; // Токен обновления действует 30 дней
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Вспомогательные функции для работы с токенами
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });

  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRATION,
  });

  return { accessToken, refreshToken };
};

const saveRefreshToken = async (userId, refreshToken) => {
  const sessionQuery = `
    INSERT INTO user_sessions (user_id, refresh_token)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE refresh_token = ?
  `;
  await query(sessionQuery, [userId, refreshToken, refreshToken]);
};

// Проверка данных Telegram
const verifyTelegramData = (data) => {
  const { hash, day, month, year, gender, ...otherData } = data;

  // Сортируем только те поля, которые должны участвовать в проверке
  const dataCheckString = Object.keys(otherData)
    .sort()
    .map(key => `${key}=${otherData[key]}`)
    .join('\n');

  logger.debug('Telegram verification', {
    dataCheckString,
    receivedHash: hash,
    botToken: TELEGRAM_BOT_TOKEN ? 'defined' : 'undefined'
  });

  const secretKey = crypto
    .createHash('sha256')
    .update(TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  logger.debug('Hash comparison', {
    calculatedHash,
    receivedHash: hash,
    match: calculatedHash === hash
  });

  return calculatedHash === hash;
};

// Вспомогательная функция для преобразования даты
const formatDate = (dateStr) => {
  if (!dateStr) return null;

  // Если дата в формате DD.MM.YYYY
  if (dateStr.includes('.')) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return dateStr;
};

// Регистрация пользователя
export const register = async (req, res) => {
  const { provider, socialData, mail, gender, birdDay, result } = req.body;

  logger.debug('Register request', { provider, socialData: socialData ? 'present' : 'missing', mail, gender, birdDay });

  try {
    // Парсим данные от Telegram, если они пришли как строка
    let parsedSocialData = socialData;
    if (typeof socialData === 'string') {
      try {
        parsedSocialData = JSON.parse(socialData);
        logger.debug('Parsed social data', parsedSocialData);
      } catch (e) {
        logger.error('Failed to parse social data', { error: e.message });
        return res.status(400).json({
          isError: true,
          message: 'Неверный формат данных от Telegram'
        });
      }
    }

    // Проверка данных от Telegram
    if (provider === 'telegram' && parsedSocialData) {
      if (!verifyTelegramData(parsedSocialData)) {
        return res.status(400).json({
          isError: true,
          message: 'Неверные данные от Telegram'
        });
      }
    }

    // Проверка обязательных полей
    if (!provider && !mail) {
      logger.debug('No provider and no mail provided');
      return res.status(400).json({
        isError: true,
        message: 'Email или данные соцсети обязательны'
      });
    }

    logger.debug('Registration', { provider, mail: mail ? 'provided' : 'missing' });

    const normalizedEmail = mail ? normalizeEmail(mail) : null;
    const confirmationToken = uuidv4();
    const confirmationExpires = new Date();
    confirmationExpires.setHours(confirmationExpires.getHours() + 360);

    // Проверяем существование пользователя
    let existingUser = null;
    if (provider === 'vk' && parsedSocialData?.user?.user_id) {
      [existingUser] = await query(
        'SELECT * FROM users WHERE provider = ? AND social_id = ?',
        [provider, parsedSocialData.user.user_id.toString()]
      );
    } else if (provider === 'telegram' && parsedSocialData?.id) {
      [existingUser] = await query(
        'SELECT * FROM users WHERE provider = ? AND social_id = ?',
        [provider, parsedSocialData.id.toString()]
      );
    } else if (normalizedEmail) {
      [existingUser] = await query(
        'SELECT * FROM users WHERE email = ?',
        [normalizedEmail]
      );
    }

    if (existingUser) {
      // Обновляем существующего пользователя
      const updateQuery = `
        UPDATE users 
        SET social_data = ?,
            is_confirmed = ?
        WHERE id = ?
      `;
      await query(updateQuery, [
        JSON.stringify(parsedSocialData) || null,
        provider ? true : existingUser.is_confirmed,
        existingUser.id
      ]);

      // Генерируем токены
      const { accessToken, refreshToken } = generateTokens(existingUser.id);
      await saveRefreshToken(existingUser.id, refreshToken);

      // Устанавливаем куки
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      return res.status(200).json({
        message: 'Пользователь обновлен',
        user: { id: existingUser.id },
        accessToken,
        refreshToken
      });
    }

    // Создаем нового пользователя
    const insertUserQuery = `
      INSERT INTO users (
        email,
        provider,
        social_id,
        social_data,
        confirmation_token,
        confirmation_expires,
        is_confirmed
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const socialId = provider === 'vk' ? parsedSocialData.user.user_id : parsedSocialData?.id;

    console.log('parsedSocialData',  normalizedEmail,
      provider || 'email',
      socialId?.toString(),
      JSON.stringify(parsedSocialData),
      confirmationToken,
      confirmationExpires,
      provider ? true : false);

    const resultQuery = await query(insertUserQuery, [
      normalizedEmail,
      provider || 'email',
      socialId?.toString() || null,
      JSON.stringify(parsedSocialData) || null,
      confirmationToken,
      confirmationExpires,
      provider ? true : false
    ]);

    const userId = resultQuery.insertId;

    // Создаем запись в таблице people
    const queryPiple = `
      INSERT INTO people (user_id, name, gender, birth_date)
      VALUES (?, ?, ?, ?)
    `;

    const name = provider === 'vk'
      ? `${parsedSocialData.user.first_name} ${parsedSocialData.user.last_name}`
      : parsedSocialData?.first_name;

    const userGender = provider === 'vk'
      ? (parsedSocialData.user.sex === 2 ? 'male' : parsedSocialData.user.sex === 1 ? 'female' : null)
      : gender;

    const birthDate = provider === 'vk'
      ? formatDate(parsedSocialData.user.birthday)
      : formatDate(birdDay);

    const resultQueryPiple = await query(queryPiple, [
      userId,
      name || 'Я',
      userGender,
      birthDate
    ]);

    const personId = resultQueryPiple.insertId;

    // Добавляем аватары
    const avatars = [
      { keyWord: 'A', avatar_id: result.A, purchased: 0, preview: 0 },
      { keyWord: 'B', avatar_id: result.B, purchased: 0, preview: 0 },
      { keyWord: 'V', avatar_id: result.V, purchased: 0, preview: 0 },
      { keyWord: 'G', avatar_id: result.G, purchased: 0, preview: 0 },
      { keyWord: 'D', avatar_id: result.D, purchased: 0, preview: 0 },
      { keyWord: 'K', avatar_id: result.K, purchased: 0, preview: 0 },
      { keyWord: 'L', avatar_id: result.L, purchased: 0, preview: 0 },
      { keyWord: 'M', avatar_id: result.M, purchased: 0, preview: 0 },
      { keyWord: 'N', avatar_id: result.N, purchased: 0, preview: 0 },
      { keyWord: 'B2', avatar_id: result.B2, purchased: 0, preview: 0 },
    ];

    // Используем batch insert вместо цикла для оптимизации
    await insertAvatarsBatch(query, personId, avatars);
    logger.debug(`Успешно добавлено ${avatars.length} аватаров для person_id: ${personId}`);

    // Если это обычная регистрация - отправляем письмо
    if (!provider) {
      logger.info('Regular registration - sending email', { email: normalizedEmail });
      await sendConfirmationEmail(normalizedEmail, confirmationToken);
      return res.status(200).json({
        message: 'Письмо с подтверждением отправлено на почту'
      });
    }

    // Для соцсетей генерируем токены
    logger.info('Social registration - generating tokens', { provider, userId });
    const { accessToken, refreshToken } = generateTokens(userId);
    await saveRefreshToken(userId, refreshToken);

    // Fire-and-forget notification (do not block registration)
    const socialIdForNotify =
      provider === 'vk' ? parsedSocialData?.user?.user_id : parsedSocialData?.id;
    notifyViaTelegramBot(
      `🎉 Новый пользователь зарегистрировался через ${provider}\nUser ID: ${userId}` +
      (socialIdForNotify ? `\nSocial ID: ${socialIdForNotify}` : '')
    ).catch(() => { });

    // Устанавливаем куки
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    logger.debug('Sending response with tokens', { userId });
    res.status(200).json({
      message: 'Пользователь успешно зарегистрирован',
      user: { id: userId },
      accessToken,
      refreshToken
    });

  } catch (error) {
    logger.error('Ошибка регистрации', { error: error.message, stack: error.stack });
    res.status(500).json({
      isError: true,
      message: 'Ошибка регистрации'
    });
  }
};

export const forgot = async (req, res) => {
  const { email } = req.body;


  const confirmationToken = uuidv4(); // Генерация уникального токена для подтверждения
  const confirmationExpires = new Date();
  confirmationExpires.setHours(confirmationExpires.getHours() + 360); // Токен действует 1 час

  const respon = await query('SELECT * FROM users WHERE email = ?', [email]);
  if (!respon || respon.length < 1) {
    return res.status(400).json({ isError: true, message: 'Не найден пользователь с таким email' });
  }

  const resultQuery = await query('UPDATE users SET confirmation_token = ?, confirmation_expires = ?, is_confirmed=? WHERE email = ?', [confirmationToken, confirmationExpires, false, email]);
  await sendConfirmationEmail(email, confirmationToken);
  res.status(200).json({ isError: false, message: 'Письмо с подтверждением отправлено на почту' });
};

// Подтверждение почты
export const confirmEmail = async (req, res) => {
  const { token } = req.params;

  try {
    const queryRequest = `SELECT * FROM users WHERE confirmation_token = ?`;
    const [user] = await query(queryRequest, [token]);

    if (!user) {
      return res.status(404).json({ message: 'Токен не найден' });
    }

    if (new Date() > new Date(user.confirmation_expires)) {
      return res.status(400).json({ message: 'Токен просрочен' });
    }

    const updateQuery = `
            UPDATE users SET is_confirmed = true WHERE confirmation_token = ?
        `;

    await query(updateQuery, [token]);

    res.status(200).json({ message: 'Почта подтверждена' });
  } catch (error) {
    logger.error('Ошибка подтверждения почты', { error: error.message });
    res.status(500).json({ message: 'Ошибка подтверждения почты' });
  }
};

export const setPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ message: 'Токен и пароль обязательны' });
  }

  try {
    const queryRequest = `SELECT * FROM users WHERE confirmation_token = ?`;
    const userReq = await query(queryRequest, [token]);
    const user = userReq[0];
    if (!user || !user.is_confirmed) {
      return res.status(400).json({ message: 'Почта не подтверждена' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatePasswordQuery = `
            UPDATE users SET password_hash = ?, confirmation_token = NULL WHERE confirmation_token = ?
        `;
    await query(updatePasswordQuery, [hashedPassword, token]);

    // Fire-and-forget notification
    notifyViaTelegramBot(`🎉 Пользователь установил пароль и завершил регистрацию\nUser ID: ${user.id}`).catch(() => { });

    res.status(200).json({ message: 'Пароль успешно установлен' });
  } catch (error) {
    logger.error('Ошибка при установке пароля', { error: error.message });
    res.status(500).json({ message: 'Ошибка при установке пароля' });
  }
};

// Авторизация
export const login = async (req, res) => {
  const { email, password, provider, socialData } = req.body;

  try {
    let user = null;

    // Если это вход через соцсеть
    if (provider && socialData) {
      let parsedSocialData;
      try {
        parsedSocialData = JSON.parse(socialData);
      } catch (e) {
        return res.status(400).json({
          isError: true,
          message: 'Неверный формат данных от соцсети'
        });
      }

      // Получаем ID пользователя в зависимости от провайдера
      const socialId = provider === 'vk'
        ? parsedSocialData.user.user_id
        : parsedSocialData.id;

      if (!socialId) {
        return res.status(400).json({
          isError: true,
          message: 'ID пользователя не найден'
        });
      }

      // Ищем пользователя по ID соцсети
      [user] = await query(
        'SELECT * FROM users WHERE provider = ? AND social_id = ?',
        [provider, socialId.toString()]
      );
    } else {
      // Обычный вход по email/паролю
      if (!email || !password) {
        return res.status(400).json({ message: 'Email и пароль обязательны' });
      }

      const normalizedEmail = normalizeEmail(email);
      [user] = await query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);

      if (!user) {
        return res.status(404).json({ message: 'Пользователь не найден' });
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordCorrect) {
        const checked = hasher.CheckPassword(password, user.password_hash);
        if (!checked) return res.status(401).json({ message: 'Неверный пароль' });
      }
    }

    if (!user) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    if (!user.is_confirmed) {
      return res.status(400).json({ message: 'Почта не подтверждена' });
    }

    // Генерация JWT токена
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
    });

    const refreshToken = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRATION,
    });

    // Сохраняем refreshToken в базе данных для дальнейшей валидации
    const sessionQuery = `
      INSERT INTO user_sessions (user_id, refresh_token)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE refresh_token = ?
    `;
    await query(sessionQuery, [user.id, refreshToken, refreshToken]);

    // Устанавливаем куки
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      message: 'Успешная авторизация',
      user: { id: user.id },
      accessToken,
      refreshToken
    });
  } catch (error) {
    logger.error('Ошибка авторизации', { error: error.message });
    res.status(500).json({ message: 'Ошибка авторизации' });
  }
};

// Обновление токенов
export const refreshTokens = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Токен обновления не предоставлен');
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    const queryRequest = `SELECT * FROM user_sessions WHERE user_id = ? AND refresh_token = ?`;
    const sessions = await query(queryRequest, [decoded.userId, refreshToken]);

    if (!sessions || sessions.length === 0) {
      throw new AuthenticationError('Неверный или просроченный токен обновления');
    }

    // Генерация новых токенов
    const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(decoded.userId);

    // Обновляем refreshToken в базе данных
    const updateSessionQuery = `UPDATE user_sessions SET refresh_token = ? WHERE user_id = ?`;
    await query(updateSessionQuery, [newRefreshToken, decoded.userId]);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error.isOperational) {
      throw error;
    }
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Неверный или просроченный токен');
    }
    logger.error('Ошибка обновления токенов', { error: error.message });
    throw new AuthenticationError('Ошибка обновления токенов');
  }
});

// Проверка сессии
export const checkSession = asyncHandler(async (req, res) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    throw new AuthenticationError('Токен не предоставлен');
  }

  // Поддерживаем формат "Bearer token" и просто "token"
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const queryRequest = `SELECT id FROM users WHERE id = ?`;
    const users = await query(queryRequest, [decoded.userId]);

    if (!users || users.length === 0) {
      throw new NotFoundError('Пользователь не найден');
    }

    res.status(200).json({ message: 'Сессия активна' });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Срок действия токена истёк');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Неверный токен');
    }
    if (error.isOperational) {
      throw error;
    }
    logger.error('Ошибка проверки сессии', { error: error.message });
    throw new AuthenticationError('Ошибка проверки токена');
  }
});


const normalizeEmail = (email) => email.toLowerCase();
