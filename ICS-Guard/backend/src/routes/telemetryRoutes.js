import express from 'express';
import { ingestTelemetryLog, controlAttackEndpoint, getBlockedIpsPublic, testTelegramConnectionEndpoint } from '../controllers/telemetryController.js';

const router = express.Router();

// Route kiểm tra kết nối Telegram Bot (Onboarding test connection)
router.post('/test-telegram-connection', testTelegramConnectionEndpoint);

// Route lấy danh sách IP bị chặn để đồng bộ tường lửa (Public cho Gateway/Simulator)
router.get('/blocked-ips', getBlockedIpsPublic);

// Public ingestion route for device simulators and log agents
router.post('/ingest', ingestTelemetryLog);

// Route for Attacker Console to trigger/stop attacks on devices
router.post('/control-attack', controlAttackEndpoint);

export default router;
