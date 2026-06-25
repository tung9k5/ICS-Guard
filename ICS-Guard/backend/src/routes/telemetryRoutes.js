import express from 'express';
import { ingestTelemetryLog } from '../controllers/telemetryController.js';

const router = express.Router();

// Public ingestion route for device simulators and log agents
router.post('/ingest', ingestTelemetryLog);

export default router;
