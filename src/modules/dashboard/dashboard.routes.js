const { Router } = require('express');
const dashboardController = require('./dashboard.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

const ALL_READ_ROLES = ['ADMIN', 'DATA_LAKE_OWNER', 'ANALYST_WRITE', 'ANALYST_READ', 'VIEWER'];

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Overall financial summary
 *     description: Returns totalIncome, totalExpenses, netBalance. Excludes soft-deleted records.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Summary data
 *       401:
 *         description: Unauthorized
 */
router.get('/summary', authenticate, authorize(...ALL_READ_ROLES), dashboardController.getSummary);

/**
 * @swagger
 * /api/dashboard/categories:
 *   get:
 *     tags: [Dashboard]
 *     summary: Category breakdown
 *     description: Returns per-category totals, counts, and percentage of total. Optional type filter.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *     responses:
 *       200:
 *         description: Category breakdown
 *       401:
 *         description: Unauthorized
 */
router.get('/categories', authenticate, authorize(...ALL_READ_ROLES), dashboardController.getCategories);

/**
 * @swagger
 * /api/dashboard/monthly-trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Monthly trends (last 12 months)
 *     description: Returns 12 month objects with totalIncome, totalExpenses, netBalance per month.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Monthly trends
 *       401:
 *         description: Unauthorized
 */
router.get('/monthly-trends', authenticate, authorize(...ALL_READ_ROLES), dashboardController.getMonthlyTrends);

/**
 * @swagger
 * /api/dashboard/weekly-trends:
 *   get:
 *     tags: [Dashboard]
 *     summary: Weekly trends
 *     description: Returns week objects with date ranges and totals. Defaults to 4 weeks.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: weeks
 *         schema: { type: integer, default: 4 }
 *     responses:
 *       200:
 *         description: Weekly trends
 *       401:
 *         description: Unauthorized
 */
router.get('/weekly-trends', authenticate, authorize(...ALL_READ_ROLES), dashboardController.getWeeklyTrends);

/**
 * @swagger
 * /api/dashboard/user-summary/{userId}:
 *   get:
 *     tags: [Dashboard]
 *     summary: Financial summary for a specific user
 *     description: Admin only. Returns income/expense/balance/record count for the specified user.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User financial summary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/user-summary/:userId', authenticate, authorize('ADMIN'), dashboardController.getUserSummary);

module.exports = router;
