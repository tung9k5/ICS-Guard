import express from 'express';
import {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
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

// POST /api/devices/:id/isolate - Admin, Analyst (Audited)
router.post('/:id/isolate', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_ISOLATE'), isolateDeviceEndpoint);

// POST /api/devices/:id/unisolate - Admin, Analyst (Audited)
router.post('/:id/unisolate', authorize(['Admin', 'Analyst']), auditLogger('DEVICE_UNISOLATE'), unisolateDeviceEndpoint);

export default router;
