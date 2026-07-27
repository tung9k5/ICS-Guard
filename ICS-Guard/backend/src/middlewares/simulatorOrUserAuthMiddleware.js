import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

const simulatorOrUserAuthMiddleware = async (req, res, next) => {
  // 1. Check simulator API Key first
  const apiKey = req.headers['x-simulator-api-key'];
  const expectedKey = process.env.SIMULATOR_API_KEY;

  if (expectedKey && apiKey === expectedKey) {
    return next();
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
