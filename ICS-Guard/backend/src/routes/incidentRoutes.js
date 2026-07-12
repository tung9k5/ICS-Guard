import express from 'express';
import { getAllIncidents, getIncidentById, triggerAiAnalysis, updateIncident, deleteIncident, deleteMultipleIncidents } from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

// All incident routes require authentication
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Incidents
 *   description: Security Incident management and timeline APIs (Roles: Admin, Analyst, Viewer)
 */

/**
 * @openapi
 * /api/incidents:
 *   get:
 *     summary: Retrieve list of all security incidents (Requires roles - admin, analyst, viewer)
 *     tags: [Incidents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/', authorize(['admin', 'analyst', 'viewer']), getAllIncidents);

/**
 * @openapi
 * /api/incidents/{id}:
 *   get:
 *     summary: Retrieve security incident details and historical timeline (Requires roles - admin, analyst, viewer)
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
 *     summary: Trigger asynchronous AI-Engine analysis on a security incident (Requires roles - admin, analyst)
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

/**
 * @openapi
 * /api/incidents/{id}:
 *   put:
 *     summary: Update an incident (Requires roles - admin, analyst)
 *     tags: [Incidents]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *               severity:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Incident updated successfully
 */
router.put('/:id', authorize(['admin', 'analyst']), updateIncident);

/**
 * @openapi
 * /api/incidents/{id}:
 *   delete:
 *     summary: Delete an incident (Requires roles - admin)
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
 *         description: Incident deleted successfully
 */
router.delete('/:id', authorize(['admin']), deleteIncident);

/**
 * @openapi
 * /api/incidents/bulk-delete:
 *   post:
 *     summary: Delete multiple incidents (Requires roles - admin)
 *     tags: [Incidents]
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
 *         description: Incidents deleted successfully
 */
router.post('/bulk-delete', authorize(['admin']), deleteMultipleIncidents);

export default router;
