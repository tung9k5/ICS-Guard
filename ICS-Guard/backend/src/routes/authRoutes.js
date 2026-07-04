import express from 'express';
import { login, refresh, logout, setupOnboarding } from '../controllers/authController.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply auditLogger to record login attempts (with sanitized inputs)
router.post('/login', auditLogger('USER_LOGIN_ATTEMPT'), login);
router.post('/refresh', refresh);
router.post('/logout', auditLogger('USER_LOGOUT'), logout);

// Setup onboarding (Thiết lập đăng nhập lần đầu)
router.post('/setup-onboarding', authMiddleware, auditLogger('USER_SETUP_ONBOARDING'), setupOnboarding);

export default router;
