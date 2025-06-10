import { query } from '../models/db.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION;
const JWT_REFRESH_EXPIRATION = '30d';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Helper function to generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION,
  });

  const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRATION,
  });

  return { accessToken, refreshToken };
};

// Helper function to save refresh token
const saveRefreshToken = async (userId, refreshToken) => {
  const sessionQuery = `
    INSERT INTO user_sessions (user_id, refresh_token)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE refresh_token = ?
  `;
  await query(sessionQuery, [userId, refreshToken, refreshToken]);
};

// Helper function to create or update user
const createOrUpdateUser = async (userData) => {
  const { email, provider, socialId, firstName, lastName, photo } = userData;
  
  // Check if user exists by social ID
  let user;
  if (provider === 'vk') {
    [user] = await query('SELECT * FROM users WHERE vk_id = ?', [socialId]);
  } else if (provider === 'telegram') {
    [user] = await query('SELECT * FROM users WHERE telegram_id = ?', [socialId]);
  }

  if (!user && email) {
    // Check if user exists by email
    [user] = await query('SELECT * FROM users WHERE email = ?', [email]);
  }

  if (user) {
    // Update existing user
    const updateQuery = `
      UPDATE users 
      SET ${provider}_id = ?,
          auth_provider = ?,
          social_data = ?,
          is_confirmed = true
      WHERE id = ?
    `;
    await query(updateQuery, [
      socialId,
      provider,
      JSON.stringify({ firstName, lastName, photo }),
      user.id
    ]);
    return user.id;
  } else {
    // Create new user
    const insertQuery = `
      INSERT INTO users (
        email,
        ${provider}_id,
        auth_provider,
        social_data,
        is_confirmed
      ) VALUES (?, ?, ?, ?, true)
    `;
    const result = await query(insertQuery, [
      email,
      socialId,
      provider,
      JSON.stringify({ firstName, lastName, photo })
    ]);
    return result.insertId;
  }
};

// VK Authentication
export const vkAuth = async (req, res) => {
  try {
    const { vkData } = req.body;
    const { id, email, firstName, lastName, photo } = vkData;

    if (!id) {
      return res.status(400).json({ message: 'VK ID is required' });
    }

    const userId = await createOrUpdateUser({
      email,
      provider: 'vk',
      socialId: id.toString(),
      firstName,
      lastName,
      photo
    });

    const { accessToken, refreshToken } = generateTokens(userId);
    await saveRefreshToken(userId, refreshToken);

    // Set cookies
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
      message: 'Successfully authenticated with VK',
      user: { id: userId }
    });
  } catch (error) {
    console.error('VK auth error:', error);
    res.status(500).json({ message: 'Error during VK authentication' });
  }
};

// Telegram Authentication
export const telegramAuth = async (req, res) => {
  try {
    const { telegramData } = req.body;
    const { id, first_name, last_name, photo_url, hash, ...otherData } = telegramData;

    if (!id || !hash) {
      return res.status(400).json({ message: 'Telegram ID and hash are required' });
    }

    // Verify Telegram data
    const dataCheckString = Object.keys(otherData)
      .sort()
      .map(key => `${key}=${otherData[key]}`)
      .join('\n');

    const secretKey = crypto
      .createHash('sha256')
      .update(TELEGRAM_BOT_TOKEN)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return res.status(400).json({ message: 'Invalid Telegram data' });
    }

    const userId = await createOrUpdateUser({
      provider: 'telegram',
      socialId: id.toString(),
      firstName: first_name,
      lastName: last_name,
      photo: photo_url
    });

    const { accessToken, refreshToken } = generateTokens(userId);
    await saveRefreshToken(userId, refreshToken);

    // Set cookies
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
      message: 'Successfully authenticated with Telegram',
      user: { id: userId }
    });
  } catch (error) {
    console.error('Telegram auth error:', error);
    res.status(500).json({ message: 'Error during Telegram authentication' });
  }
}; 
