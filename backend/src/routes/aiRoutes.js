import express from 'express';
import rateLimit from 'express-rate-limit';
import { processChatMessage } from '../controllers/aiController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// AI-specific rate limiter — stricter than global (AI calls are expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute per IP
  message: { error: 'TooManyRequests', message: 'Quá nhiều yêu cầu AI. Vui lòng chờ 1 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authMiddleware);
router.use(aiLimiter);

router.post('/chat', processChatMessage);

export default router;
