import express from 'express';
import { launchAttack, getAttackDevices, deleteAttackDevice, deleteMultipleAttackDevices } from '../controllers/attackController.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();
/**
 * @openapi
 * tags:
 *   name: Attacks
 *   description: Simulated attack launcher APIs
 */

/**
 * @openapi
 * /api/attacks/launch:
 *   post:
 *     summary: Launch a simulated attack on a device
 *     tags: [Attacks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - device_id
 *               - attack_type
 *             properties:
 *               device_id:
 *                 type: string
 *               attack_type:
 *                 type: string
 *     responses:
 *       200:
 *         description: Attack launched successfully
 *       500:
 *         description: Failed to publish attack command
 */
router.post('/launch', launchAttack);

/**
 * @openapi
 * /api/attacks/devices:
 *   get:
 *     summary: Get devices available for attack simulation
 *     tags: [Attacks]
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
 *                   type:
 *                     type: string
 *                   zone:
 *                     type: string
 *                   status:
 *                     type: string
 */
router.get('/devices', getAttackDevices);

/**
 * @openapi
 * /api/attacks/devices/bulk-delete:
 *   post:
 *     summary: Delete multiple attack devices (Requires roles - Admin)
 *     tags: [Attacks]
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
 *         description: Devices deleted successfully
 */
router.post('/devices/bulk-delete', authMiddleware, authorize(['Admin']), deleteMultipleAttackDevices);

/**
 * @openapi
 * /api/attacks/devices/{id}:
 *   delete:
 *     summary: Delete an attack device (Requires roles - Admin)
 *     tags: [Attacks]
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
 *         description: Device deleted successfully
 */
router.delete('/devices/:id', authMiddleware, authorize(['Admin']), deleteAttackDevice);

export default router;
