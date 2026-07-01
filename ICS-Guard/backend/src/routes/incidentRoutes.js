import express from 'express';
import { getAllIncidents, getIncidentById, triggerAiAnalysis } from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

// All incident routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Incidents
 *   description: Security Incident management and timeline APIs
 */

/**
 * @openapi
 * /api/incidents:
 *   get:
 *     summary: Retrieve list of all security incidents
 *     tags: [Incidents]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', authorize(['admin', 'analyst', 'viewer']), getAllIncidents);

/**
 * @openapi
 * /api/incidents/{id}:
 *   get:
 *     summary: Retrieve security incident details and historical timeline
 *     tags: [Incidents]
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
 *         description: Success
 *       404:
 *         description: Incident not found
 */
router.get('/:id', authorize(['admin', 'analyst', 'viewer']), getIncidentById);

/**
 * @openapi
 * /api/incidents/{id}/ai-analyze:
 *   post:
 *     summary: Trigger asynchronous AI-Engine analysis on a security incident
 *     tags: [Incidents]
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
 *         description: AI Analysis triggered successfully
 */
router.post('/:id/ai-analyze', authorize(['admin', 'analyst']), triggerAiAnalysis);

export default router;
