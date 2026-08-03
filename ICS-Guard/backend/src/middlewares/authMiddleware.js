import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { normalizeRole } from '../utils/roles.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token is missing or malformed.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'The user associated with this token no longer exists.',
      });
    }

    if (user.status === 'locked' || user.is_active === false || user.deletion_pending === true) {
      return res.status(403).json({
        error: 'ACCOUNT_DEACTIVATED',
        message: 'Tài khoản của bạn đã bị vô hiệu hóa hoặc bị khóa bởi Quản trị viên.',
      });
    }

    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > new Date()) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Your account has been locked due to too many failed login attempts.',
      });
    }

    // Keep existing demo databases compatible after the canonical role rename.
    user.role = normalizeRole(user.role);

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
