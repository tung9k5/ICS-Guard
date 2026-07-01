import express from 'express';
import { ingestTelemetryLog } from '../controllers/telemetryController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { getEmergencyAlerts } from '../services/sessionRegistry.js';

const router = express.Router();

/**
 * @openapi
 * tags:
 *   name: Telemetry
 *   description: Ingestion and processing of logs and telemetry
 */

/**
 * @openapi
 * /api/telemetry/ingest:
 *   post:
 *     summary: Ingest telemetry/auth logs from simulated or physical devices
 *     tags: [Telemetry]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *             properties:
 *               device_id:
 *                 type: string
 *                 example: plc-01
 *               log_type:
 *                 type: string
 *                 example: auth
 *               event:
 *                 type: string
 *                 example: AUTH_FAILED
 *               source_ip:
 *                 type: string
 *                 example: 185.220.101.45
 *               username:
 *                 type: string
 *                 example: root
 *               timestamp:
 *                 type: string
 *                 example: "2026-06-08T09:00:00Z"
 *     responses:
 *       200:
 *         description: Log ingested successfully
 *       400:
 *         description: Bad request (validation or replay attack blocked)
 */
router.post('/ingest', ingestTelemetryLog);

/**
 * @openapi
 * /api/telemetry/emergency:
 *   get:
 *     summary: Poll active emergency alerts (for fallback purposes)
 *     tags: [Telemetry]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/emergency', authMiddleware, (req, res) => {
  return res.status(200).json(getEmergencyAlerts());
});

export default router;
