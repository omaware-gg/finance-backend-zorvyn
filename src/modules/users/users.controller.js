const usersService = require('./users.service');
const { updateUserSchema } = require('./users.schema');
const { sendSuccess, sendError } = require('../../utils/response.utils');

async function getAllUsers(req, res) {
  try {
    const { page, limit, search, role, isActive } = req.query;
    const data = await usersService.getAllUsers({ page, limit, search, role, isActive });
    return sendSuccess(res, data, 'Users retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getUserById(req, res) {
  try {
    const data = await usersService.getUserById(req.params.id);
    return sendSuccess(res, data, 'User retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function updateUser(req, res) {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 'Validation failed', 400, parsed.error.issues, 'VALIDATION_ERROR');
    }

    const data = await usersService.updateUser(req.params.id, parsed.data, req.user.id);
    return sendSuccess(res, data, 'User updated');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function softDeleteUser(req, res) {
  try {
    const data = await usersService.softDeleteUser(req.params.id, req.user.id);
    return sendSuccess(res, data, data.message);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getApiKeyForUser(req, res) {
  try {
    const data = await usersService.getApiKeyForUser(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, data, 'API key retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

// ─── Database Backup Logs ───────────────────────────────────────────────────

async function createBackupLog(req, res) {
  try {
    const { action, targetDatabase, backupLocation } = req.body;
    if (!action || !targetDatabase || !backupLocation) {
      return sendError(res, 'action, targetDatabase, and backupLocation are required', 400, null, 'VALIDATION_ERROR');
    }
    const data = await usersService.createBackupLog(
      { action, targetDatabase, backupLocation },
      req.user.id
    );
    return sendSuccess(res, data, 'Backup log created', 201);
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getAllBackupLogs(req, res) {
  try {
    const data = await usersService.getAllBackupLogs();
    return sendSuccess(res, data, 'Backup logs retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function updateBackupLog(req, res) {
  try {
    const { status } = req.body;
    if (!status || !['COMPLETED', 'RESTORED'].includes(status)) {
      return sendError(res, 'status must be COMPLETED or RESTORED', 400, null, 'VALIDATION_ERROR');
    }
    const data = await usersService.updateBackupLog(req.params.id, { status });
    return sendSuccess(res, data, 'Backup log updated');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  softDeleteUser,
  getApiKeyForUser,
  createBackupLog,
  getAllBackupLogs,
  updateBackupLog,
};
