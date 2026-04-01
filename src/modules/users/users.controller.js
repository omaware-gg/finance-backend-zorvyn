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

module.exports = { getAllUsers, getUserById, updateUser, softDeleteUser, getApiKeyForUser };
