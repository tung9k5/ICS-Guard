import express from 'express';
import { handleChat } from '../controllers/aiController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redisClient from '../config/redis.js';

const router = express.Router();

const aiChatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each user to 30 requests per 15 minutes
  keyGenerator: (req) => {
    return req.user ? String(req.user.id) : (req.ip || '127.0.0.1');
  },
  message: { error: 'TooManyRequests', message: 'Tần suất trò chuyện quá nhanh, vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

router.post('/chat', authMiddleware, aiChatLimiter, handleChat);

export default router;
