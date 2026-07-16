import express from 'express';
import { ingestLog, controlAttack, testTelegramConnection } from '../controllers/telemetryController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateIngestLog,
  validateControlAttack
} from '../validators/telemetryValidator.js';

const router = express.Router();

router.post('/ingest', validateIngestLog, ingestLog);

router.use(authMiddleware);
router.use(authorize(['admin', 'l3_manager', 'l2_responder']));

router.post('/control-attack', validateControlAttack, auditLogger('CONTROL_ATTACK'), controlAttack);
router.post('/test-telegram', auditLogger('TEST_TELEGRAM'), testTelegramConnection);

export default router;
