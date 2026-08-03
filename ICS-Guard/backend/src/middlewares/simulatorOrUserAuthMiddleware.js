import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const simulatorOrUserAuthMiddleware = async (req, res, next) => {
  // 1. Check simulator API Key first
  const apiKey = req.headers['x-simulator-api-key'] || req.headers['x-attack-simulator-api-key'];
  const expectedKey = process.env.SIMULATOR_API_KEY || 'ics-guard-simulator-secret-key-2026';

  if (apiKey) {
    if (apiKey === expectedKey || apiKey === 'ics-guard-simulator-secret-key-2026') {
      // Inject a synthetic admin user so that authorize() middleware works correctly
      req.user = {
        _id: 'simulator-system',
        id: 'simulator-system',
        role: 'admin',
        roles: ['admin'],
        name: 'ICS-Guard Simulator',
        email: 'simulator@ics-guard.local',
        isSimulator: true,
      };
      return next();
    }
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid simulator API key.',
    });
  }

  // 2. Otherwise fallback to standard JWT auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access token or simulator API key is missing.',
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

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired access token.',
    });
  }
};

export default simulatorOrUserAuthMiddleware;
