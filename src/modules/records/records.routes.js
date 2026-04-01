const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const recordsController = require('./records.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

const READ_ROLES = ['ADMIN', 'DATA_LAKE_OWNER', 'ANALYST_WRITE', 'ANALYST_READ', 'VIEWER'];
const WRITE_ROLES = ['ADMIN', 'ANALYST_WRITE'];

// Per-route-group rate limiters (separate from global app-level limiter)
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

router.get('/', readLimiter, authenticate, authorize(...READ_ROLES), recordsController.getAllRecords);
router.get('/:id', readLimiter, authenticate, authorize(...READ_ROLES), recordsController.getRecordById);

router.post('/', authenticate, authorize(...WRITE_ROLES), writeLimiter, recordsController.createRecord);
router.patch('/:id', authenticate, authorize(...WRITE_ROLES), writeLimiter, recordsController.updateRecord);
router.delete('/:id', authenticate, authorize('ADMIN'), writeLimiter, recordsController.softDeleteRecord);

module.exports = router;
