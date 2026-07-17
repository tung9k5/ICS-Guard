import express from 'express';
import {
  getAuditLogs,
  getBlockedIps,
  unblockIp,
  deleteAuditLog,
  bulkDeleteAuditLogs
} from '../controllers/auditController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { validateUnblockIp } from '../validators/auditValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);
router.use(authorize(['admin']));

router.get('/logs', validatePagination, getAuditLogs);
router.delete('/logs/:id', validateMongoId, auditLogger('AUDIT_LOG_DELETE'), deleteAuditLog);
router.post('/logs/bulk-delete', validateBulkIds, auditLogger('AUDIT_LOG_BULK_DELETE'), bulkDeleteAuditLogs);

router.get('/blocked-ips', validatePagination, getBlockedIps);
router.post('/unblock-ip', validateUnblockIp, unblockIp);

export default router;
