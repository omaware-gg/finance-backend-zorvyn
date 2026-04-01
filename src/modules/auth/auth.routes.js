const { Router } = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/verify-otp', authController.verifyAdminOtp);

router.get('/me', authenticate, authController.getMe);
router.post('/enable-2fa', authenticate, authorize('ADMIN'), authController.enableAdminOtp);
router.post('/rotate-api-key', authenticate, authController.rotateApiKey);

module.exports = router;
