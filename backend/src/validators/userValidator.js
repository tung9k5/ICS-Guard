import { errorResponse } from '../utils/response.js';
import { EMAIL_REGEX } from '../utils/regex.js';
import { VALID_ROLES } from '../constants/index.js';

export const validateCreateUser = (req, res, next) => {
  const { username, password, role, email } = req.body;

  if (!username || !password || !role || !email) {
    return errorResponse(res, 'Username, password, email, and role are required', null, 400);
  }

  if (!VALID_ROLES.includes(role)) {
    return errorResponse(res, `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, null, 400);
  }

  if (!EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'Invalid email format', null, 400);
  }

  next();
};

export const validateUpdateUser = (req, res, next) => {
  const { role, email } = req.body;

  if (role && !VALID_ROLES.includes(role)) {
    return errorResponse(res, 'Invalid role', null, 400);
  }

  if (email && !EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'Invalid email format', null, 400);
  }

  next();
};

export const validateProfile = (req, res, next) => {
  const { email } = req.body;
  if (email && !EMAIL_REGEX.test(email)) {
    return errorResponse(res, 'Invalid email format', null, 400);
  }
  next();
};
