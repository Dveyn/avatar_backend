// Валидация входных данных
import { body, validationResult } from 'express-validator';
import { ValidationError } from './errors.js';

// Middleware для проверки результатов валидации
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value
    }));
    return next(new ValidationError('Ошибка валидации данных', errorMessages));
  }
  next();
};

// Валидация регистрации
export const validateRegister = [
  body('mail')
    .optional()
    .isEmail()
    .withMessage('Некорректный email')
    .normalizeEmail(),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Некорректное значение пола'),
  body('birdDay')
    .optional()
    .isISO8601()
    .withMessage('Некорректная дата рождения'),
  body('result')
    .optional()
    .isObject()
    .withMessage('Результат должен быть объектом'),
  validate
];

// Валидация входа
export const validateLogin = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Некорректный email')
    .normalizeEmail(),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов'),
  validate
];

// Валидация восстановления пароля
export const validateForgot = [
  body('email')
    .isEmail()
    .withMessage('Некорректный email')
    .normalizeEmail(),
  validate
];

// Валидация установки пароля
export const validateSetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Токен обязателен'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен содержать минимум 6 символов')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Пароль должен содержать заглавные и строчные буквы, а также цифры'),
  validate
];

// Валидация добавления человека
export const validateAddPerson = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Имя обязательно')
    .isLength({ min: 1, max: 100 })
    .withMessage('Имя должно быть от 1 до 100 символов'),
  body('birdDay')
    .optional()
    .isISO8601()
    .withMessage('Некорректная дата рождения'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Некорректное значение пола'),
  body('result')
    .optional()
    .isObject()
    .withMessage('Результат должен быть объектом'),
  validate
];

// Валидация транзакции
export const validateTransaction = [
  body('item')
    .notEmpty()
    .withMessage('Поле item обязательно'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Сумма должна быть положительным числом'),
  validate
];
