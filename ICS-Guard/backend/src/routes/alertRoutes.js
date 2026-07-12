import express from 'express';
import {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  deleteAlert,
  deleteMultipleAlerts
} from '../controllers/alertController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Raw Alert Management API
 */

const router = express.Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get all alerts with pagination and filters
 *     tags: [Alerts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', getAllAlerts);
router.get('/:id', getAlertById);

// Analysts and above can modify alert status
router.patch('/:id/status', authorize(['admin', 'l3_manager', 'l2_responder', 'l1_analyst']), auditLogger('ALERT_UPDATE_STATUS'), updateAlertStatus);

// Responders/Managers/Admins can delete alerts
router.delete('/:id', authorize(['admin', 'l3_manager', 'l2_responder']), auditLogger('ALERT_DELETE'), deleteAlert);
router.post('/bulk-delete', authorize(['admin', 'l3_manager', 'l2_responder']), auditLogger('ALERT_BULK_DELETE'), deleteMultipleAlerts);

export default router;
