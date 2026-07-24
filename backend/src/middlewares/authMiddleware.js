import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AUTH_CONSTANTS } from '../constants/index.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = req.cookies?.[AUTH_CONSTANTS.ACCESS_TOKEN_COOKIE];

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
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
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'The user associated with this token no longer exists.',
      });
    }

    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > new Date()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been locked due to too many failed login attempts.',
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
    return res.status(401).json({
      error: 'Unauthorized',
      message,
    });
  }
};

export default authMiddleware;
