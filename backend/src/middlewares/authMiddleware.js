import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AUTH_CONSTANTS, ROLES } from '../constants/index.js';
import { HTTP_STATUS } from '../constants/index.js';


const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const origin = req.headers.origin || req.headers.referer || '';
  let role = ROLES.CUSTOMER;
  if (process.env.FRONTEND_ADM_URL && origin.startsWith(process.env.FRONTEND_ADM_URL)) {
    role = ROLES.ADMIN;
  }
  
  let token = req.cookies?.[`${AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE}_${role}`] || req.cookies?.[AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE];

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Unauthorized',
      message: 'Access token is missing or malformed.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [process.env.JWT_ALGORITHM]
    });
    
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        message: 'The user associated with this token no longer exists.',
      });
    }

    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > new Date()) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({
        error: 'Forbidden',
        message: 'Your account has been locked due to too many failed login attempts.',
      });
    }

    if (user.role !== role) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Unauthorized',
        message: 'Your role is not authorized to access this portal.',
      });
    }

    // Attach user information to request
    req.user = user;
    next();
  } catch (error) {
    let message = 'Invalid or expired access token.';
    if (error.name === 'TokenExpiredError') {
      message = 'Access token has expired.';
    }
    return res.status(HTTP_STATUS.UNAUTHORIZED).json({
      error: 'Unauthorized',
      message,
    });
  }
};

export default authMiddleware;
