import { successResponse } from '../utils/response.js';
import authService from '../services/authService.js';
import { AUTH_CONSTANTS } from '../constants/index.js';

const setAuthCookies = (res, accessToken, refreshToken) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    domain: process.env.COOKIE_DOMAIN,
  };
  res.cookie(AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE, accessToken, cookieOptions);
  res.cookie(AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions);
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const loginIdentifier = username;
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');

    const result = await authService.login(loginIdentifier, password, ipAddress);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] || req.body.refreshToken || req.body.refresh_token;
    const result = await authService.refresh(token);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] || req.body.refreshToken || req.body.refresh_token;
    if (token) {
      await authService.logout(token);
    }
    const cookieOptions = { domain: process.env.COOKIE_DOMAIN };
    res.clearCookie(AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE, cookieOptions);
    res.clearCookie(AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE, cookieOptions);
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

export const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const result = await authService.googleLogin(req.body.idToken);

    setAuthCookies(res, result.accessToken, result.refreshToken);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getGoogleAuthUrl = (req, res, next) => {
  try {
    const url = authService.getGoogleAuthUrl();
    return successResponse(res, { url }, 'Google auth URL generated successfully');
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      throw new AppError('Authorization code is required', 400);
    }
    const result = await authService.googleCallback(code);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    
    const frontendUrl = process.env.FRONTEND_URL;
    return res.redirect(`${frontendUrl}/login/callback`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL;
    return res.redirect(`${frontendUrl}/login?error=google_login_failed`);
  }
};
