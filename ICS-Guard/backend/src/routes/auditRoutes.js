import express from 'express';
import { getAuditLogs, getBlockedIps, unblockIp, deleteAuditLog, deleteMultipleAuditLogs } from '../controllers/auditController.js';
import { getDeviceLogs, getDeviceAverages } from '../controllers/deviceLogController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all audit routes
router.use(authMiddleware);

// GET /api/audits/logs - admin, hr_manager
router.get('/logs', authorize(['admin', 'hr_management']), getAuditLogs);

// GET /api/audits/blocked-ips - admin, hr_manager
router.get('/blocked-ips', authorize(['admin', 'hr_management']), getBlockedIps);

// GET /api/audits/device-logs - admin, device_manager, soc_analyst, hr_manager
router.get('/device-logs', authorize(['admin', 'device_management', 'analyst', 'hr_management']), getDeviceLogs);

// GET /api/audits/device-averages - admin, device_manager, soc_analyst, hr_manager
router.get('/device-averages', authorize(['admin', 'device_management', 'analyst', 'hr_management']), getDeviceAverages);

// POST /api/audits/unblock-ip - admin, device_manager (Audited)
router.post('/unblock-ip', authorize(['admin', 'device_management']), auditLogger('IP_MANUAL_UNBLOCK'), unblockIp);

/**
 * @openapi
 * /api/audits/logs/bulk-delete:
 *   post:
 *     summary: Delete multiple audit logs (Requires roles - Admin)
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Logs deleted successfully
 */
router.post('/logs/bulk-delete', authorize(['Admin']), deleteMultipleAuditLogs);

/**
 * @openapi
 * /api/audits/logs/{id}:
 *   delete:
 *     summary: Delete an audit log (Requires roles - Admin)
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Log deleted successfully
 */
router.delete('/logs/:id', authorize(['Admin']), deleteAuditLog);

export default router;
