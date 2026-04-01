const { Router } = require('express');
const authController = require('./auth.controller');
const { authenticate } = require('../../middlewares/auth.middleware');
const { authorize } = require('../../middlewares/rbac.middleware');

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Self-registration creates a VIEWER by default. An authenticated ADMIN can pass a role to assign.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Must contain at least one letter and one number
 *               role:
 *                 type: string
 *                 enum: [ADMIN, DATA_LAKE_OWNER, ANALYST_WRITE, ANALYST_READ, VIEWER, NO_ACCESS]
 *     responses:
 *       201:
 *         description: User registered (includes apiKey — only visible at creation)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already registered
 */
router.post('/register', authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: Returns a JWT token. If the user is an ADMIN with 2FA enabled, returns requiresOtp instead and sends an OTP email.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful or OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify admin 2FA OTP
 *     description: Second step of admin login. Submit the 6-digit OTP received via email to obtain a JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 pattern: '^\d{6}$'
 *     responses:
 *       200:
 *         description: OTP verified — JWT token returned
 *       401:
 *         description: Invalid or expired OTP
 */
router.post('/verify-otp', authController.verifyAdminOtp);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile without sensitive fields.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, authController.getMe);

/**
 * @swagger
 * /api/auth/enable-2fa:
 *   post:
 *     tags: [Auth]
 *     summary: Enable TOTP 2FA for an admin account
 *     description: Generates and stores a TOTP secret. Only ADMIN role can enable this.
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — not ADMIN
 */
router.post('/enable-2fa', authenticate, authorize('ADMIN'), authController.enableAdminOtp);

/**
 * @swagger
 * /api/auth/rotate-api-key:
 *   post:
 *     tags: [Auth]
 *     summary: Rotate the current user's API key
 *     description: Generates a new API key. The new key is returned only once.
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: New API key returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: string
 *                     headerName:
 *                       type: string
 *       401:
 *         description: Unauthorized
 */
router.post('/rotate-api-key', authenticate, authController.rotateApiKey);

module.exports = router;
