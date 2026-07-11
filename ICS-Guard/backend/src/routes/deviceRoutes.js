import express from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteMultipleDevices,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
  rollbackDeviceEndpoint,
} from '../controllers/deviceController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

// Apply authMiddleware globally to all device routes
router.use(authMiddleware);

/**
 * @openapi
 * tags:
 *   name: Devices
 *   description: IoT Device Management APIs (Roles: Admin, Analyst, Viewer, L3 Manager, OT Operator)
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
router.get('/', authorize(['Admin', 'Analyst', 'Viewer']), getAllDevices);

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
router.get('/:id', authorize(['Admin', 'Analyst', 'Viewer']), getDeviceById);
router.post('/', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_CREATE'), createDevice);
router.put('/:id', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_UPDATE'), updateDevice);
router.delete('/:id', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_DELETE'), deleteDevice);
router.post('/bulk-delete', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_BULK_DELETE'), deleteMultipleDevices);

// POST /api/devices/:id/isolate - Admin, L3 SOC Manager (Audited)
router.post('/:id/isolate', authorize(['admin', 'l3_manager']), auditLogger('DEVICE_ISOLATE'), isolateDeviceEndpoint);

// POST /api/devices/:id/unisolate - Admin, L3 SOC Manager (Audited)
router.post('/:id/unisolate', authorize(['admin', 'l3_manager']), auditLogger('DEVICE_UNISOLATE'), unisolateDeviceEndpoint);

// POST /api/devices/:id/rollback - Admin, L3 SOC Manager, OT Operator (Audited)
router.post('/:id/rollback', authorize(['admin', 'l3_manager', 'ot_operator']), auditLogger('DEVICE_ROLLBACK'), rollbackDeviceEndpoint);

export default router;
