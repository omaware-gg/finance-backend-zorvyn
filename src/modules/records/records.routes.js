const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const recordsController = require('./records.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

const READ_ROLES = ['ADMIN', 'DATA_LAKE_OWNER', 'ANALYST_WRITE', 'ANALYST_READ', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'ANALYST_WRITE'];

const readLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many read requests. Try again later.', code: 'RATE_LIMITED' },
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many write requests. Try again later.', code: 'RATE_LIMITED' },
});

/**
 * @swagger
 * /api/records:
 *   get:
 *     tags: [Records]
 *     summary: List financial records
 *     description: Paginated list with filtering, sorting, and search. All authenticated roles except NO_ACCESS.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [INCOME, EXPENSE] }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *         description: Case-insensitive contains
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: partitionKey
 *         schema: { type: string }
 *         description: Exact match e.g. "2024-03"
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search category and notes
 *       - in: query
 *         name: minAmount
 *         schema: { type: number }
 *       - in: query
 *         name: maxAmount
 *         schema: { type: number }
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, enum: [date, amount, createdAt, category], default: date }
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated records list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       429:
 *         description: Rate limited
 */
router.get('/', readLimiter, authenticate, authorize(...READ_ROLES), recordsController.getAllRecords);

/**
 * @swagger
 * /api/records/{id}:
 *   get:
 *     tags: [Records]
 *     summary: Get a single financial record
 *     description: Returns record with creator info. Soft-deleted records are excluded.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Record found
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/FinancialRecord'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Record not found
 */
router.get('/:id', readLimiter, authenticate, authorize(...READ_ROLES), recordsController.getRecordById);

/**
 * @swagger
 * /api/records:
 *   post:
 *     tags: [Records]
 *     summary: Create a financial record
 *     description: ADMIN and ANALYST_WRITE only. Duplicate-write guard blocks near-identical records within 5 seconds.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Record created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Duplicate write detected
 *       429:
 *         description: Rate limited
 */
router.post('/', authenticate, authorize(...WRITE_ROLES), writeLimiter, recordsController.createRecord);

/**
 * @swagger
 * /api/records/{id}:
 *   patch:
 *     tags: [Records]
 *     summary: Update a financial record (optimistic locking)
 *     description: >
 *       Requires `version` in request body for optimistic concurrency control.
 *       If the version doesn't match the DB, returns 409 CONCURRENCY_CONFLICT.
 *       ANALYST_WRITE can only update their own records.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [version]
 *             properties:
 *               version:
 *                 type: integer
 *                 description: Current version of the record (required for concurrency)
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Record updated (version incremented)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not owner for ANALYST_WRITE)
 *       404:
 *         description: Record not found
 *       409:
 *         description: Concurrency conflict — version mismatch
 *       429:
 *         description: Rate limited
 */
router.patch('/:id', authenticate, authorize(...WRITE_ROLES), writeLimiter, recordsController.updateRecord);

/**
 * @swagger
 * /api/records/{id}:
 *   delete:
 *     tags: [Records]
 *     summary: Soft-delete a financial record (admin only)
 *     description: Sets deletedAt and deletedBy. Hard deletion is architecturally disabled.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Record soft-deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Record not found
 *       429:
 *         description: Rate limited
 */
router.delete('/:id', authenticate, authorize('ADMIN'), writeLimiter, recordsController.softDeleteRecord);

module.exports = router;
