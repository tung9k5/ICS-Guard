import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const attackAuthMiddleware = async (req, res, next) => {
  // 1. Check attack simulator API Key first (only allowed in non-production)
  const apiKey = req.headers['x-attack-simulator-api-key'];
  const expectedKey = process.env.ATTACK_SIMULATOR_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }
  }

  // 2. Otherwise fallback to standard JWT + Role auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token or valid API key is missing.',
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

    // Role validation
    const allowedRoles = ['admin', 'device_management', 'analyst'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to trigger attacks.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired access token.',
    });
  }
};

export default attackAuthMiddleware;
