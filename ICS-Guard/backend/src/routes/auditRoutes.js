import express from 'express';
import { getAuditLogs, getBlockedIps, unblockIp } from '../controllers/auditController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all audit routes
router.use(authMiddleware);

// GET /api/audits/logs - Admin, Analyst
router.get('/logs', authorize(['Admin', 'Analyst']), getAuditLogs);

// GET /api/audits/blocked-ips - Admin, Analyst
router.get('/blocked-ips', authorize(['Admin', 'Analyst']), getBlockedIps);

// POST /api/audits/unblock-ip - Admin, L3 SOC Manager (Audited)
router.post('/unblock-ip', authorize(['admin', 'l3_manager']), auditLogger('IP_MANUAL_UNBLOCK'), unblockIp);

export default router;
