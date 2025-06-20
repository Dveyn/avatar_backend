import dotenv from 'dotenv';
dotenv.config();

import { query } from '../models/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendConfirmationEmail } from '../utils/email.js';
import { v4 as uuidv4 } from 'uuid';
import hasher from 'wordpress-hash-node';
import crypto from 'crypto';

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

  console.log('Telegram verification:', {
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

  console.log('Hash comparison:', {
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
  
  console.log('Register request:', { provider, socialData: socialData ? 'present' : 'missing', mail, gender, birdDay, result });
  
  try {
    // Парсим данные от Telegram, если они пришли как строка
    let parsedSocialData = socialData;
    if (typeof socialData === 'string') {
      try {
        parsedSocialData = JSON.parse(socialData);
        console.log('Parsed social data:', parsedSocialData);
      } catch (e) {
        console.error('Failed to parse social data:', e);
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
      console.log('No provider and no mail provided');
      return res.status(400).json({ 
        isError: true, 
        message: 'Email или данные соцсети обязательны' 
      });
    }

    console.log('Provider:', provider, 'Mail:', mail);

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
        JSON.stringify(parsedSocialData),
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

    const socialId = provider === 'vk' ? parsedSocialData.user.user_id : parsedSocialData.id;

    const resultQuery = await query(insertUserQuery, [
      normalizedEmail,
      provider || 'email',
      socialId?.toString(),
      JSON.stringify(parsedSocialData),
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
      : parsedSocialData.first_name || 'Я';

    const userGender = provider === 'vk'
      ? (parsedSocialData.user.sex === 2 ? 'male' : parsedSocialData.user.sex === 1 ? 'female' : null)
      : gender;

    const birthDate = provider === 'vk'
      ? formatDate(parsedSocialData.user.birthday)
      : formatDate(birdDay);

    const resultQueryPiple = await query(queryPiple, [
      userId,
      name,
      userGender,
      birthDate
    ]);

    const personId = resultQueryPiple.insertId;

    // Добавляем аватары
    const avatars = [
      { keyWord: 'A', avatar_id: result.A, purchased: 0, preview: 1 },
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

    const avatarQuery = `
      INSERT INTO avatars (person_id, keyWord, avatar_id, purchased, preview)
      VALUES (?, ?, ?, ?, ?)
    `;

    for (const avatar of avatars) {
      await query(avatarQuery, [
        personId,
        avatar.keyWord,
        avatar.avatar_id,
        avatar.purchased,
        avatar.preview
      ]);
    }

    // Если это обычная регистрация - отправляем письмо
    if (!provider) {
      console.log('Regular registration - sending email');
      await sendConfirmationEmail(normalizedEmail, confirmationToken);
      return res.status(200).json({
        message: 'Письмо с подтверждением отправлено на почту'
      });
    }

    // Для соцсетей генерируем токены
    console.log('Social registration - generating tokens for provider:', provider);
    const { accessToken, refreshToken } = generateTokens(userId);
    await saveRefreshToken(userId, refreshToken);

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

    console.log('Sending response with tokens for user:', userId);
    res.status(200).json({
      message: 'Пользователь успешно зарегистрирован',
      user: { id: userId },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Ошибка регистрации:', error);
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
  console.log(respon);
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
    console.error(error);
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
    console.log(user, user.is_confirmed, !user.is_confirmed);
    if (!user || !user.is_confirmed) {
      return res.status(400).json({ message: 'Почта не подтверждена' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatePasswordQuery = `
            UPDATE users SET password_hash = ?, confirmation_token = NULL WHERE confirmation_token = ?
        `;
    await query(updatePasswordQuery, [hashedPassword, token]);

    res.status(200).json({ message: 'Пароль успешно установлен' });
  } catch (error) {
    console.error(error);
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
    console.error('Ошибка авторизации:', error);
    res.status(500).json({ message: 'Ошибка авторизации' });
  }
};

// Обновление токенов
export const refreshTokens = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Токен обновления не предоставлен' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET);

    const queryRequest = `SELECT * FROM user_sessions WHERE user_id = ? AND refresh_token = ?`;
    const session = await query(queryRequest, [decoded.userId, refreshToken]);

    if (!session) {
      return res.status(400).json({ message: 'Неверный или просроченный токен обновления' });
    }

    // Генерация новых токенов
    const newAccessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRATION,
    });

    const newRefreshToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRATION,
    });

    // Обновляем refreshToken в базе данных
    const updateSessionQuery = `
            UPDATE user_sessions SET refresh_token = ? WHERE user_id = ?
        `;
    await query(updateSessionQuery, [newRefreshToken, decoded.userId]);

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка обновления токенов' });
  }
};

// Проверка сессии
export const checkSession = async (req, res) => {
  const { authorization: accessToken } = req.headers;
  if (!accessToken) {
    return res.status(400).json({ message: 'Токен не предоставлен' });
  }
  try {
    const decoded = jwt.verify(accessToken, JWT_SECRET);

    const queryRequest = `SELECT * FROM users WHERE id = ?`;
    const user = await query(queryRequest, [decoded.userId]);

    if (!user) {
      return res.status(400).json({ message: 'Пользователь не найден' });
    }

    res.status(200).json({ message: 'Сессия активна' });
  } catch (error) {
    console.error(error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Срок действия токена истёк' });
    }

    res.status(400).json({ message: 'Неверный токен' });
  }
};


const normalizeEmail = (email) => email.toLowerCase();
