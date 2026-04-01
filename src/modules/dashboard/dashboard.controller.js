const dashboardService = require('./dashboard.service');
const { sendSuccess, sendError } = require('../../utils/response.utils');

async function getSummary(req, res) {
  try {
    const data = await dashboardService.getSummary();
    return sendSuccess(res, data, 'Dashboard summary retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getCategories(req, res) {
  try {
    const data = await dashboardService.getCategories(req.query.type);
    return sendSuccess(res, data, 'Category breakdown retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getMonthlyTrends(req, res) {
  try {
    const data = await dashboardService.getMonthlyTrends();
    return sendSuccess(res, data, 'Monthly trends retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getWeeklyTrends(req, res) {
  try {
    const weeks = parseInt(req.query.weeks, 10) || 4;
    const data = await dashboardService.getWeeklyTrends(weeks);
    return sendSuccess(res, data, 'Weekly trends retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

async function getUserSummary(req, res) {
  try {
    const data = await dashboardService.getUserSummary(req.params.userId);
    return sendSuccess(res, data, 'User summary retrieved');
  } catch (err) {
    return sendError(res, err.message, err.statusCode || 500, null, err.code || 'INTERNAL_ERROR');
  }
}

module.exports = { getSummary, getCategories, getMonthlyTrends, getWeeklyTrends, getUserSummary };
