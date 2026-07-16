import { errorResponse } from '../utils/response.js';

export const validateCreateUser = (req, res, next) => {
  const { username, password, role, email } = req.body;

  if (!username || !password || !role || !email) {
    return errorResponse(res, 'Username, password, email, and role are required', null, 400);
  }

  const validRoles = ['admin', 'l1_analyst', 'l2_responder', 'l3_manager', 'ot_operator'];
  if (!validRoles.includes(role)) {
    return errorResponse(res, `Invalid role. Must be one of: ${validRoles.join(', ')}`, null, 400);
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return errorResponse(res, 'Invalid email format', null, 400);
  }

  next();
};

export const validateUpdateUser = (req, res, next) => {
  const { role, email } = req.body;

  if (role) {
    const validRoles = ['admin', 'l1_analyst', 'l2_responder', 'l3_manager', 'ot_operator'];
    if (!validRoles.includes(role)) {
      return errorResponse(res, 'Invalid role', null, 400);
    }
  }
  
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', null, 400);
    }
  }

  next();
};

export const validateProfile = (req, res, next) => {
  const { email } = req.body;
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(res, 'Invalid email format', null, 400);
    }
  }
  next();
};
