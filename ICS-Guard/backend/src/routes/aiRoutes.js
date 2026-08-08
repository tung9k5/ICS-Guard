import express from 'express';
import { handleChat, getAlertSummary, summarizeTimeline } from '../controllers/aiController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
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
router.get('/alert-summary', authMiddleware, getAlertSummary);
router.post('/summarize-timeline', authMiddleware, summarizeTimeline);

router.post('/classify/train', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const axios = (await import('axios')).default;
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';
    const response = await axios.post(`${aiEngineUrl}/classify/train`, req.body, {
      timeout: 120000,
      maxBodyLength: 11 * 1024 * 1024,
    });
    return res.json(response.data);
  } catch (err) {
    console.error('[AiRoutes] Error triggering retraining:', err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message: err.response?.data?.detail || err.message,
    });
  }
});

router.post('/models/:id/activate', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const axios = (await import('axios')).default;
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';
    const response = await axios.post(
      `${aiEngineUrl}/models/${encodeURIComponent(req.params.id)}/activate`,
      {},
      { timeout: 30000 }
    );
    return res.json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message: err.response?.data?.detail || err.message,
    });
  }
});

/**
 * POST /api/ai/retrain
 * Extract training dataset from MongoDB alerts/incidents and trigger AI retrain
 * Requires: admin role
 */
router.post('/retrain', authMiddleware, authorize(['admin']), async (req, res) => {
  try {
    const { Alert, Incident, AuditLog } = await import('../models/index.js');
    const axios = (await import('axios')).default;
    const aiEngineUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';

    // Extract labeled dataset from MongoDB
    // Use resolved/false_positive alerts as labeled training samples
    const labeledAlerts = await Alert.find({
      status: { $in: ['resolved', 'false_positive'] },
    }).lean().limit(5000);

    const dataset = labeledAlerts.map(alert => ({
      rule_name: alert.rule_name || 'UNKNOWN',
      severity: alert.severity || 'MEDIUM',
      event_count: alert.event_count || 1,
      has_source_ip: Boolean(alert.source_ip),
      label: alert.status === 'resolved' ? 1 : 0, // 1=real attack, 0=false positive
    }));

    if (dataset.length < 10) {
      return res.status(422).json({
        error: 'Insufficient training data',
        message: `Cần ít nhất 10 mẫu đã được phân loại để huấn luyện lại. Hiện tại chỉ có ${dataset.length} mẫu.`,
      });
    }

    // Call AI Engine retrain endpoint
    const response = await axios.post(`${aiEngineUrl}/retrain`, {
      dataset,
      triggered_by: req.user?.username || 'admin',
      timestamp: new Date().toISOString(),
    }, {
      timeout: 300000, // 5 minutes for training
    });

    // Audit the retrain event
    await AuditLog.create({
      action: 'AI_MODEL_RETRAIN_TRIGGERED',
      username: req.user?.username || 'admin',
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: {
        dataset_size: dataset.length,
        ai_engine_url: aiEngineUrl,
        result: response.data,
      },
      status: 'SUCCESS',
    });

    return res.json({
      message: `Huấn luyện lại mô hình AI thành công với ${dataset.length} mẫu dữ liệu.`,
      dataset_size: dataset.length,
      result: response.data,
    });
  } catch (err) {
    console.error('[AiRoutes] /retrain error:', err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({
      error: status >= 500 ? 'Internal Server Error' : 'Bad Request',
      message: err.response?.data?.detail || err.message,
    });
  }
});

export default router;
