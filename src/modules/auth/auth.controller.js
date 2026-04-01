const authService = require('./auth.service');
const { registerSchema, loginSchema, verifyOtpSchema } = require('./auth.schema');
const { sendSuccess, sendError } = require('../../utils/response.utils');

async function register(req, res) {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await authService.register(parsed.data);
    return sendSuccess(res, data, 'User registered successfully', 201);
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

async function login(req, res) {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await authService.login(parsed.data);
    return sendSuccess(res, data, data.requiresOtp ? data.message : 'Login successful');
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

async function verifyAdminOtp(req, res) {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await authService.verifyAdminOtp(parsed.data);
    return sendSuccess(res, data, 'OTP verified — login complete');
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

async function enableAdminOtp(req, res) {
  try {
    const data = await authService.enableAdminOtp(req.user.id);
    return sendSuccess(res, data, data.message);
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

async function getMe(req, res) {
  try {
    const data = await authService.getMe(req.user.id);
    return sendSuccess(res, data, 'User profile retrieved');
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

async function rotateApiKey(req, res) {
  try {
    const data = await authService.rotateApiKey(req.user.id);
    return sendSuccess(res, data, 'API key rotated successfully');
  } catch (err) {
    return sendError(
      res,
      err.message,
      err.statusCode || 500,
      null,
      err.code || 'INTERNAL_ERROR'
    );
  }
}

module.exports = { register, login, verifyAdminOtp, enableAdminOtp, getMe, rotateApiKey };
