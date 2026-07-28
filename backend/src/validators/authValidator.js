import { errorResponse } from '../utils/response.js';
import { EMAIL_REGEX } from '../utils/regex.js';
import { AUTH_CONSTANTS } from '../constants/index.js';

export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return errorResponse(res, 'Username and password are required', null, 400);
  }
  next();
};

export const validateRegister = (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return errorResponse(res, 'Username, email, and password are required', null, 400);
  }

  if (!EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'Invalid email format', null, 400);
  }

  if (password.length < 6) {
    return errorResponse(res, 'Password must be at least 6 characters', null, 400);
  }

  next();
};

export const validateRefreshToken = (req, res, next) => {
  const refreshToken = req.cookies?.[AUTH_CONSTANTS.REFRESH_TOKEN_COOKIE] || req.body.refreshToken || req.body.refresh_token;
  if (!refreshToken) {
    return errorResponse(res, 'Refresh token is required', null, 400);
  }
  next();
};

export const validateGoogleLogin = (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) {
    return errorResponse(res, 'Google ID token is required', null, 400);
  }
  next();
};
