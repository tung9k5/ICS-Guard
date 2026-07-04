import express from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
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

// GET /api/devices - Admin, Analyst, Viewer
router.get('/', authorize(['Admin', 'Analyst', 'Viewer']), getAllDevices);

// GET /api/devices/:id - Admin, Analyst, Viewer
router.get('/:id', authorize(['Admin', 'Analyst', 'Viewer']), getDeviceById);

// POST /api/devices - Admin, Analyst (Audited)
router.post('/', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_CREATE'), createDevice);

// PUT /api/devices/:id - Admin, Analyst (Audited)
router.put('/:id', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_UPDATE'), updateDevice);

// DELETE /api/devices/:id - Admin, Analyst (Audited)
router.delete('/:id', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_DELETE'), deleteDevice);

// POST /api/devices/:id/isolate - Admin, L3 SOC Manager (Audited)
router.post('/:id/isolate', authorize(['admin', 'l3_manager']), auditLogger('DEVICE_ISOLATE'), isolateDeviceEndpoint);

// POST /api/devices/:id/unisolate - Admin, L3 SOC Manager (Audited)
router.post('/:id/unisolate', authorize(['admin', 'l3_manager']), auditLogger('DEVICE_UNISOLATE'), unisolateDeviceEndpoint);

// POST /api/devices/:id/rollback - Admin, L3 SOC Manager, OT Operator (Audited)
router.post('/:id/rollback', authorize(['admin', 'l3_manager', 'ot_operator']), auditLogger('DEVICE_ROLLBACK'), rollbackDeviceEndpoint);

export default router;
