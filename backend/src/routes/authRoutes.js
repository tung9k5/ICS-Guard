import express from 'express';
import {
  login,
  refreshToken,
  logout,
  getProfile,
  register,
  googleLogin,
} from '../controllers/authController.js';
import { updateProfile } from '../controllers/userController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateLogin,
  validateRegister,
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
router.put('/profile', authMiddleware, auditLogger('PROFILE_UPDATE'), updateProfile);

export default router;
