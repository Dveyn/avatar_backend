// Централизованная обработка ошибок

export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Ошибка аутентификации') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Недостаточно прав доступа') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Ресурс не найден') {
    super(message, 404);
  }
}

// Обертка для async функций
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Глобальный обработчик ошибок
export const errorHandler = (err, req, res, next) => {
  // Если заголовки уже отправлены, передаем ошибку стандартному обработчику
  if (res.headersSent) {
    return next(err);
  }

  // Логирование ошибки
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (!err.isOperational || isDevelopment) {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
  }

  // Определяем статус код
  const statusCode = err.statusCode || 500;
  
  // Формируем ответ
  const response = {
    isError: true,
    message: err.isOperational ? err.message : 'Внутренняя ошибка сервера',
    ...(err.errors && { errors: err.errors }),
    ...(isDevelopment && { stack: err.stack })
  };

  res.status(statusCode).json(response);
};

// Обработчик 404
export const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Маршрут ${req.method} ${req.url} не найден`);
  next(error);
};
