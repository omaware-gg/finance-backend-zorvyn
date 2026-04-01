const config = require('../config/env');

/**
 * Global Express error handler. Must be registered last (4-arg signature).
 */
function errorHandler(err, req, res, _next) {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = null;

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token has expired. Please login again.';
    code = 'TOKEN_EXPIRED';
  }

  // Zod validation errors
  else if (err.name === 'ZodError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  }

  // Prisma errors
  else if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    switch (err.code) {
      case 'P2002':
        statusCode = 409;
        code = 'CONFLICT';
        message = 'A record with this value already exists';
        break;
      case 'P2025':
        statusCode = 404;
        code = 'NOT_FOUND';
        message = 'Record not found';
        break;
      case 'P2034':
        statusCode = 409;
        code = 'CONCURRENCY_CONFLICT';
        message = 'Write conflict. Please retry.';
        break;
    }
  }

  // In production, never expose internal messages for 500s
  if (statusCode === 500 && config.nodeEnv === 'production') {
    message = 'An unexpected error occurred';
  }

  const body = { success: false, message, code };
  if (errors) body.errors = errors;
  if (config.nodeEnv !== 'production' && err.stack) body.stack = err.stack;

  return res.status(statusCode).json(body);
}

module.exports = { errorHandler };
