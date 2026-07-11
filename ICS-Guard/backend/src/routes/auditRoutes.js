import express from 'express';
import { getAuditLogs, getBlockedIps, unblockIp } from '../controllers/auditController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all audit routes
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Audit
 *   description: Audit logs and blocked IPs APIs (Roles: Admin, Analyst, L3 Manager)
 */

/**
 * @openapi
 * /api/audits/logs:
 *   get:
 *     summary: Get all audit logs (Requires roles - Admin, Analyst)
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   username:
 *                     type: string
 *                   action:
 *                     type: string
 *                   ipAddress:
 *                     type: string
 *                   userAgent:
 *                     type: string
 *                   details:
 *                     type: object
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
// GET /api/audits/logs - Admin, Analyst
router.get('/logs', authorize(['Admin', 'Analyst']), getAuditLogs);

/**
 * @openapi
 * /api/audits/blocked-ips:
 *   get:
 *     summary: Get all blocked IPs (Requires roles - Admin, Analyst)
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   ipAddress:
 *                     type: string
 *                   reason:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 */
// GET /api/audits/blocked-ips - Admin, Analyst
router.get('/blocked-ips', authorize(['Admin', 'Analyst']), getBlockedIps);

/**
 * @openapi
 * /api/audits/unblock-ip:
 *   post:
 *     summary: Unblock an IP (Requires roles - admin, l3_manager)
 *     tags: [Audit]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ipAddress
 *             properties:
 *               ipAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: IP unblocked successfully
 *       404:
 *         description: IP not found
 */
// POST /api/audits/unblock-ip - Admin, L3 SOC Manager (Audited)
router.post('/unblock-ip', authorize(['admin', 'l3_manager']), auditLogger('IP_MANUAL_UNBLOCK'), unblockIp);

export default router;
