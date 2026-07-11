import express from 'express';
import { login, refresh, logout, setupOnboarding, register, me, googleLogin } from '../controllers/authController.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Auth
 *   description: User authentication and session management APIs
 */

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in to the system
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin_soc
 *               password:
 *                 type: string
 *                 example: Admin@123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid username or password
 *       403:
 *         description: Account locked due to brute force
 */
router.post('/login', auditLogger('USER_LOGIN_ATTEMPT'), login);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token rotation
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Tokens successfully rotated
 *       401:
 *         description: Invalid, revoked or expired refresh token
 */
router.post('/refresh', refresh);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Log out and revoke refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', auditLogger('USER_LOGOUT'), logout);

// Setup onboarding (Thiết lập đăng nhập lần đầu)
router.post('/setup-onboarding', authMiddleware, auditLogger('USER_SETUP_ONBOARDING'), setupOnboarding);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 */
router.get('/me', authMiddleware, me);

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               full_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration successful
 */
router.post('/register', auditLogger('USER_REGISTER'), register);

/**
 * @openapi
 * /api/auth/google-login:
 *   post:
 *     summary: Log in to the system using Google Sign-In
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Bad Request
 *       401:
 *         description: Unauthorized
 */
router.post('/google-login', auditLogger('USER_GOOGLE_LOGIN_ATTEMPT'), googleLogin);

export default router;
