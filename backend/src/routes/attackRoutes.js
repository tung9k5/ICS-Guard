import express from 'express';
import {
  launchAttack,
  getAllAttackDevices,
  deleteAttackDevice,
  bulkDeleteAttackDevices
} from '../controllers/attackController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { validateLaunchAttack } from '../validators/attackValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(['admin'])); // Only high level roles can manage attacks

router.post('/launch', validateLaunchAttack, auditLogger('ATTACK_LAUNCH'), launchAttack);

router.get('/devices', validatePagination, getAllAttackDevices);
router.delete('/devices/:id', validateMongoId, auditLogger('ATTACK_DEVICE_DELETE'), deleteAttackDevice);
router.post('/devices/bulk-delete', validateBulkIds, auditLogger('ATTACK_DEVICE_BULK_DELETE'), bulkDeleteAttackDevices);

export default router;
