import { successResponse } from '../utils/response.js';
import authService from '../services/authService.js';

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');

    const result = await authService.login(email, password, ipAddress);
    
    res.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.cookie('refresh_token', result.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token || req.body.refreshToken || req.body.refresh_token;
    const result = await authService.refresh(token);

    res.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.cookie('refresh_token', result.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refresh_token || req.body.refreshToken || req.body.refresh_token;
    if (token) {
      await authService.logout(token);
    }
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const profile = await authService.getProfile(req.user.id);
    return successResponse(res, profile, 'Profile retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const setupOnboarding = async (req, res, next) => {
  try {
    const { newPassword, email, telegramChatId } = req.body;
    const result = await authService.setupOnboarding(req.user.id, newPassword, email, telegramChatId);
    
    res.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.cookie('refresh_token', result.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });

    return successResponse(res, result, result.message);
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    
    res.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.cookie('refresh_token', result.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });

    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const result = await authService.googleLogin(req.body.idToken);
    
    res.cookie('access_token', result.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });
    res.cookie('refresh_token', result.refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Strict' });

    return res.json(result);
  } catch (error) {
    next(error);
  }
};
