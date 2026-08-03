import express from 'express';
import { ingestTelemetryLog, controlAttackEndpoint, getBlockedIpsPublic, ingestSyslogEndpoint, ingestCsvEndpoint } from '../controllers/telemetryController.js';
import deviceAuthMiddleware from '../middlewares/deviceAuthMiddleware.js';
import attackAuthMiddleware from '../middlewares/attackAuthMiddleware.js';

const router = express.Router();

// Route lấy danh sách IP bị chặn để đồng bộ tường lửa (Public có khóa API thiết bị)
router.get('/blocked-ips', deviceAuthMiddleware, getBlockedIpsPublic);

// Ingestion route for device simulators and log agents (Yêu cầu API key thiết bị)
router.post('/ingest', deviceAuthMiddleware, ingestTelemetryLog);

// Route ingest Syslog (RFC 3164/5424)
router.post('/syslog', deviceAuthMiddleware, ingestSyslogEndpoint);

// Route ingest CSV Log
router.post('/upload-logs', deviceAuthMiddleware, ingestCsvEndpoint);

if (process.env.ENABLE_LEGACY_ATTACK_ROUTES === 'true' || process.env.NODE_ENV === 'test') {
  router.post('/control-attack', attackAuthMiddleware, controlAttackEndpoint);
} else {
  router.all('/control-attack', (req, res) => res.status(410).json({
    error: 'Gone',
    message: 'Legacy attack control was replaced by the standalone Attack Adapter.',
  }));
}

export default router;
