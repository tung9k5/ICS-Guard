import express from 'express';
import {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  deleteAlert,
  bulkDeleteAlerts
} from '../controllers/alertController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { validateUpdateAlertStatus } from '../validators/alertValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', validatePagination, getAllAlerts);
router.post('/bulk-delete', authorize(['admin']), validateBulkIds, auditLogger('ALERT_BULK_DELETE'), bulkDeleteAlerts);

router.get('/:id', validateMongoId, getAlertById);
router.put('/:id/status', authorize(['admin', 'customer']), validateMongoId, validateUpdateAlertStatus, auditLogger('ALERT_STATUS_UPDATE'), updateAlertStatus);
router.delete('/:id', authorize(['admin']), validateMongoId, auditLogger('ALERT_DELETE'), deleteAlert);

export default router;
