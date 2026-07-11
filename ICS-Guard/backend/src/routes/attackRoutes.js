import express from 'express';
import { launchAttack, getAttackDevices } from '../controllers/attackController.js';

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

export default router;
