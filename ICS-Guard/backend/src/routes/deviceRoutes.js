import express from 'express';
import {
  getAllDevices,
  getAllDevicesRaw,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteMultipleDevices,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
  rollbackDeviceEndpoint,
  provisionDeviceEndpoint,
  decommissionDeviceEndpoint,
  handleSimulatorHardwareCrud,
  updateOperationalStatus,
} from '../controllers/deviceController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

import simulatorAuthMiddleware from '../middlewares/simulatorAuthMiddleware.js';
import simulatorOrUserAuthMiddleware from '../middlewares/simulatorOrUserAuthMiddleware.js';

const router = express.Router();

const legacySimulatorEnabled = (
  process.env.ENABLE_LEGACY_SIMULATOR_ROUTES === 'true'
  || process.env.NODE_ENV === 'test'
);

router.get('/', simulatorOrUserAuthMiddleware, getAllDevices);
if (legacySimulatorEnabled) {
  router.get('/public/list', simulatorOrUserAuthMiddleware, getAllDevices);
  router.get('/public/list-all', simulatorOrUserAuthMiddleware, getAllDevicesRaw);
  router.post('/public/simulator-crud', simulatorAuthMiddleware, handleSimulatorHardwareCrud);
} else {
  router.all(['/public/list', '/public/list-all', '/public/simulator-crud'], (req, res) => (
    res.status(410).json({
      error: 'Gone',
      message: 'Legacy simulator routes were replaced by the Hardware BFF.',
    })
  ));
}


// Apply simulatorOrUserAuthMiddleware to all other device routes
// This allows BOTH simulator API key AND JWT Bearer token access
router.use(simulatorOrUserAuthMiddleware);

/**
 * @openapi
 * tags:
 *   name: Devices
 *   description: IoT Device Management APIs (Roles Admin, Analyst, Viewer, L3 Manager, OT Operator)
 */

/**
 * @openapi
 * /api/devices:
 *   get:
 *     summary: Get all registered devices (Requires roles - Admin, Analyst, Viewer)
 *     tags: [Devices]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, type, ipAddress
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by device type
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order by creation date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: per_page
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                       zone:
 *                         type: string
 *                       ipAddress:
 *                         type: string
 *                       ip_address:
 *                         type: string
 *                       macAddress:
 *                         type: string
 *                       mac_address:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     count:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     current_page:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *                     links:
 *                       type: object
 *   post:
 *     summary: Register a new device (Requires roles - Admin, Analyst)
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
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Device registered successfully
 */


/**
 * @openapi
 * /api/devices/{id}:
 *   get:
 *     summary: Get device details by ID (Requires roles - Admin, Analyst, Viewer)
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
 *     summary: Update device configurations (Requires roles - Admin, Analyst)
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
 *     summary: Delete a device registration (Requires roles - Admin, Analyst)
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
router.get('/:id', authorize(['admin', 'device_management', 'analyst']), getDeviceById);
router.post('/', authorize(['admin', 'device_management']), auditLogger('DEVICE_CREATE'), createDevice);
router.put('/:id', authorize(['admin', 'device_management']), auditLogger('DEVICE_UPDATE'), updateDevice);
router.delete('/:id', authorize(['admin', 'device_management']), auditLogger('DEVICE_DELETE'), deleteDevice);

// POST /api/devices/:id/isolate - admin, device_manager (Audited)
router.post('/:id/isolate', authorize(['admin', 'device_management']), auditLogger('DEVICE_ISOLATE'), isolateDeviceEndpoint);

// POST /api/devices/:id/unisolate - admin, device_manager (Audited)
router.post('/:id/unisolate', authorize(['admin', 'device_management']), auditLogger('DEVICE_UNISOLATE'), unisolateDeviceEndpoint);

// POST /api/devices/:id/rollback - admin, device_manager (Audited)
router.post('/:id/rollback', authorize(['admin', 'device_management']), auditLogger('DEVICE_ROLLBACK'), rollbackDeviceEndpoint);

// Lifecycle routes - admin, device_manager (Audited)
router.post('/:id/provision', authorize(['admin', 'device_management']), auditLogger('DEVICE_PROVISION'), provisionDeviceEndpoint);
router.delete('/:id/decommission', authorize(['admin', 'device_management']), auditLogger('DEVICE_DECOMMISSION'), decommissionDeviceEndpoint);

// PATCH /api/devices/:id/operational-status — simulator reconnect
router.patch('/:id/operational-status', simulatorOrUserAuthMiddleware, auditLogger('DEVICE_STATUS_UPDATE'), updateOperationalStatus);

export default router;
