import { successResponse } from '../utils/response.js';
import authService from '../services/authService.js';
import { AUTH_CONSTANTS, ROLES } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/index.js';


const determineRoleFromOrigin = (req) => {
  const origin = req.headers.origin || req.headers.referer || '';
  if (process.env.FRONTEND_ADM_URL && origin.startsWith(process.env.FRONTEND_ADM_URL)) {
    return ROLES.ADMIN;
  }
  return ROLES.CUSTOMER;
};

const setAuthCookies = (res, accessToken, refreshToken, req) => {
  const role = determineRoleFromOrigin(req);
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: AUTH_CONSTANTS.COOKIE_MAX_AGE,
  };
  
  if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== 'localhost') {
    cookieOptions.domain = process.env.COOKIE_DOMAIN;
  }
  
  res.cookie(`${AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE}_${role}`, accessToken, cookieOptions);
  res.cookie(`${AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE}_${role}`, refreshToken, cookieOptions);
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const loginIdentifier = username;
    const rawIp = req.ip || req.connection.remoteAddress;
    const ipAddress = rawIp.replace(/^::ffff:/, '');

    const expectedRole = determineRoleFromOrigin(req);

    const result = await authService.login(loginIdentifier, password, ipAddress, expectedRole);

    setAuthCookies(res, result.accessToken, result.refreshToken, req);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const role = determineRoleFromOrigin(req);
    const token = req.cookies?.[`${AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE}_${role}`] || req.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] || req.body.refreshToken || req.body.refresh_token;
    const result = await authService.refresh(token);

    setAuthCookies(res, result.accessToken, result.refreshToken, req);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    const role = determineRoleFromOrigin(req);
    const token = req.cookies?.[`${AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE}_${role}`] || req.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] || req.body.refreshToken || req.body.refresh_token;
    if (token) {
      await authService.logout(token);
    }
    const cookieOptions = {};
    if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== 'localhost') {
      cookieOptions.domain = process.env.COOKIE_DOMAIN;
    }
    res.clearCookie(`${AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE}_${role}`, cookieOptions);
    res.clearCookie(`${AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE}_${role}`, cookieOptions);
    // Also clear the legacy cookies just in case
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
    const expectedRole = determineRoleFromOrigin(req);
    const result = await authService.register({ ...req.body, role: expectedRole });

    setAuthCookies(res, result.accessToken, result.refreshToken, req);
    return res.status(HTTP_STATUS.CREATED).json(result);
  } catch (error) {
    next(error);
  }
};

export const googleLogin = async (req, res, next) => {
  try {
    const expectedRole = determineRoleFromOrigin(req);
    const result = await authService.googleLogin(req.body.idToken, expectedRole);

    setAuthCookies(res, result.accessToken, result.refreshToken, req);
    return res.json(result);
  } catch (error) {
    next(error);
  }
};

export const getGoogleAuthUrl = (req, res, next) => {
  try {
    const role = determineRoleFromOrigin(req);
    const url = authService.getGoogleAuthUrl(role);
    return successResponse(res, { url }, 'Google auth URL generated successfully');
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      throw new AppError('Authorization code is required', HTTP_STATUS.BAD_REQUEST);
    }
    const expectedRole = state || ROLES.CUSTOMER;
    const result = await authService.googleCallback(code, expectedRole);
    setAuthCookies(res, result.accessToken, result.refreshToken, { headers: { origin: expectedRole === ROLES.ADMIN ? process.env.FRONTEND_ADM_URL : process.env.FRONTEND_CTM_URL } });
    
    const frontendUrl = expectedRole === ROLES.ADMIN ? process.env.FRONTEND_ADM_URL : process.env.FRONTEND_CTM_URL;
    return res.redirect(`${frontendUrl}/login/callback`);
  } catch (error) {
    const expectedRole = req.query.state || ROLES.CUSTOMER;
    const frontendUrl = expectedRole === ROLES.ADMIN ? process.env.FRONTEND_ADM_URL : process.env.FRONTEND_CTM_URL;
    return res.redirect(`${frontendUrl}/login?error=google_login_failed`);
  }
};
