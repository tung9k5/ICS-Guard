import express from 'express';
import { getAuditLogs, getBlockedIps, unblockIp } from '../controllers/auditController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all audit routes
router.use(authMiddleware);

// GET /api/audits/logs - admin, hr_manager, device_manager, analyst
router.get('/logs', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getAuditLogs);

// GET /api/audits/blocked-ips - admin, hr_manager, device_manager, analyst
router.get('/blocked-ips', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getBlockedIps);

// POST /api/audits/unblock-ip - admin, device_manager (Audited)
router.post('/unblock-ip', authorize(['admin', 'device_manager']), auditLogger('IP_MANUAL_UNBLOCK'), unblockIp);

export default router;
