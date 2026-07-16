import express from 'express';
import {
  login,
  refreshToken,
  logout,
  getProfile,
  setupOnboarding,
  register,
  googleLogin,
} from '../controllers/authController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateLogin,
  validateRegister,
  validateOnboarding,
  validateRefreshToken,
  validateGoogleLogin
} from '../validators/authValidator.js';

const router = express.Router();

router.post('/login', validateLogin, auditLogger('USER_LOGIN'), login);
router.post('/google', validateGoogleLogin, auditLogger('USER_GOOGLE_LOGIN'), googleLogin);
router.post('/refresh', validateRefreshToken, refreshToken);
router.post('/logout', validateRefreshToken, auditLogger('USER_LOGOUT'), logout);

router.post('/register', validateRegister, auditLogger('USER_REGISTER'), register);

router.get('/profile', authMiddleware, getProfile);
router.post('/onboarding', authMiddleware, validateOnboarding, auditLogger('USER_ONBOARDING'), setupOnboarding);

export default router;
