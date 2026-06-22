import express from 'express';
import { login, refresh, logout } from '../controllers/authController.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply auditLogger to record login attempts (with sanitized inputs)
router.post('/login', auditLogger('USER_LOGIN_ATTEMPT'), login);
router.post('/refresh', refresh);
router.post('/logout', auditLogger('USER_LOGOUT'), logout);

export default router;
