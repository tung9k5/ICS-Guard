import express from 'express';
import {
  getAllDevices,
  getAllDevicesRaw,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
  rollbackDeviceEndpoint,
  provisionDeviceEndpoint,
  decommissionDeviceEndpoint,
  handleSimulatorHardwareCrud,
} from '../controllers/deviceController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Public routes (No Auth required)
router.get('/public/list', getAllDevices);
router.get('/public/list-all', getAllDevicesRaw);   // Plain array — for Python simulator & AI engine
router.post('/public/simulator-crud', handleSimulatorHardwareCrud);

// Lifecycle routes
router.post('/:id/provision', provisionDeviceEndpoint);
router.delete('/:id/decommission', decommissionDeviceEndpoint);

// Apply authMiddleware globally to all other device routes
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Devices
 *   description: IoT Device Management APIs
 */

/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: Get all registered devices
 *     tags: [Devices]
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
 *                   name:
 *                     type: string
 *                   type:
 *                     type: string
 *                   zone:
 *                     type: string
 *                   ipAddress:
 *                     type: string
 *                   status:
 *                     type: string
 *   post:
 *     summary: Register a new device
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ipAddress
 *               - macAddress
 *             properties:
 *               name:
 *                 type: string
 *                 example: PLC-Siemens-S7
 *               type:
 *                 type: string
 *                 example: PLC
 *               zone:
 *                 type: string
 *                 example: Factory Floor A
 *               ipAddress:
 *                 type: string
 *                 example: 192.168.1.100
 *               macAddress:
 *                 type: string
 *                 example: "00:1A:2B:3C:4D:5E"
 *     responses:
 *       201:
 *         description: Device registered successfully
 */
router.get('/', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getAllDevices);

/**
 * @openapi
 * /api/devices/{id}:
 *   get:
 *     summary: Get device details by ID
 *     tags: [Devices]
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
 *         description: Device not found
 *   put:
 *     summary: Update device configurations
 *     tags: [Devices]
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
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               zone:
 *                 type: string
 *               ipAddress:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Device updated successfully
 *   delete:
 *     summary: Delete a device registration
 *     tags: [Devices]
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
router.get('/:id', authorize(['admin', 'hr_manager', 'device_manager', 'analyst']), getDeviceById);
router.post('/', authorize(['admin', 'device_manager']), auditLogger('DEVICE_CREATE'), createDevice);
router.put('/:id', authorize(['admin', 'device_manager']), auditLogger('DEVICE_UPDATE'), updateDevice);
router.delete('/:id', authorize(['admin', 'device_manager']), auditLogger('DEVICE_DELETE'), deleteDevice);

// POST /api/devices/:id/isolate - admin, device_manager (Audited)
router.post('/:id/isolate', authorize(['admin', 'device_manager']), auditLogger('DEVICE_ISOLATE'), isolateDeviceEndpoint);

// POST /api/devices/:id/unisolate - admin, device_manager (Audited)
router.post('/:id/unisolate', authorize(['admin', 'device_manager']), auditLogger('DEVICE_UNISOLATE'), unisolateDeviceEndpoint);

// POST /api/devices/:id/rollback - admin, device_manager (Audited)
router.post('/:id/rollback', authorize(['admin', 'device_manager']), auditLogger('DEVICE_ROLLBACK'), rollbackDeviceEndpoint);

export default router;
