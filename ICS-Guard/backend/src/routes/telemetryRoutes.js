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

// Route for Attacker Console to trigger/stop attacks on devices (Bảo mật bằng Attack Auth)
router.post('/control-attack', attackAuthMiddleware, controlAttackEndpoint);

export default router;
