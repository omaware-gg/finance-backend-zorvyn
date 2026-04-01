const { Router } = require('express');
const usersController = require('./users.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

const adminOnly = [authenticate, authorize('ADMIN')];

router.get('/', ...adminOnly, usersController.getAllUsers);
router.get('/:id', ...adminOnly, usersController.getUserById);
router.patch('/:id', ...adminOnly, usersController.updateUser);
router.delete('/:id', ...adminOnly, usersController.softDeleteUser);

// Any authenticated user can retrieve their own key; ADMIN can retrieve anyone's (checked in service)
router.get('/:id/api-key', authenticate, usersController.getApiKeyForUser);

module.exports = router;
