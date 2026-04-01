const { Router } = require('express');
const usersController = require('./users.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();
const adminRouter = Router();

const adminOnly = [authenticate, authorize('ADMIN')];

// ─── /api/users ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List all users (admin only)
 *     description: Paginated user list with optional search, role, and isActive filters.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 100 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name or email
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [ADMIN, DATA_LAKE_OWNER, ANALYST_WRITE, ANALYST_READ, VIEWER, NO_ACCESS] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Paginated users list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', ...adminOnly, usersController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID (admin only)
 *     description: Returns user profile with record count.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:id', ...adminOnly, usersController.getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user (admin only)
 *     description: Update name, role, or isActive. Changing role to NO_ACCESS auto-deactivates.
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               role:
 *                 type: string
 *                 enum: [ADMIN, DATA_LAKE_OWNER, ANALYST_WRITE, ANALYST_READ, VIEWER, NO_ACCESS]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.patch('/:id', ...adminOnly, usersController.updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Soft-delete a user (admin only)
 *     description: Sets deletedAt and deactivates. Cannot delete yourself.
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User soft-deleted
 *       400:
 *         description: Cannot delete yourself
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.delete('/:id', ...adminOnly, usersController.softDeleteUser);

/**
 * @swagger
 * /api/users/{id}/api-key:
 *   get:
 *     tags: [Users]
 *     summary: Retrieve a user's API key
 *     description: Any user can retrieve their own key. ADMIN can retrieve any user's key.
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
 *         description: API key and headerName returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     headerName: { type: string }
 *                     apiKey: { type: string }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */
router.get('/:id/api-key', authenticate, usersController.getApiKeyForUser);

// ─── /api/admin (DB backup logs) ────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/db-backup-log:
 *   post:
 *     tags: [Admin]
 *     summary: Create a database backup log entry
 *     description: Audit trail for DB-level destructive operations. Admin only. Expires in 30 days.
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action, targetDatabase, backupLocation]
 *             properties:
 *               action:
 *                 type: string
 *                 example: DATABASE_DROP_REQUESTED
 *               targetDatabase:
 *                 type: string
 *                 example: finance_db
 *               backupLocation:
 *                 type: string
 *                 example: s3://finance-backup/2024-03-01/
 *     responses:
 *       201:
 *         description: Backup log created
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DatabaseBackupLog'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
adminRouter.post('/db-backup-log', ...adminOnly, usersController.createBackupLog);

/**
 * @swagger
 * /api/admin/db-backup-logs:
 *   get:
 *     tags: [Admin]
 *     summary: List all database backup logs
 *     description: Returns all backup log entries sorted by newest first. Admin only.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Backup logs list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
adminRouter.get('/db-backup-logs', ...adminOnly, usersController.getAllBackupLogs);

/**
 * @swagger
 * /api/admin/db-backup-logs/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update backup log status
 *     description: Set status to COMPLETED or RESTORED. Admin only.
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [COMPLETED, RESTORED]
 *     responses:
 *       200:
 *         description: Backup log updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Backup log not found
 */
adminRouter.patch('/db-backup-logs/:id', ...adminOnly, usersController.updateBackupLog);

module.exports = { usersRouter: router, adminApiRouter: adminRouter };
