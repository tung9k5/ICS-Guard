import express from 'express';
import {
  getAllDevices,
  createDevice,
  getDeviceById,
  updateDevice,
  deleteDevice,
  bulkDeleteDevices,
  isolateDevice,
  unisolateDevice,
  rollbackDevice
} from '../controllers/deviceController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import { 
  validateCreateDevice, 
  validateUpdateDevice, 
  validateDeviceId 
} from '../validators/deviceValidator.js';
import { validateBulkIds, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', validatePagination, getAllDevices);
router.post('/', authorize(['admin']), validateCreateDevice, auditLogger('DEVICE_CREATE'), createDevice);
router.post('/bulk-delete', authorize(['admin']), validateBulkIds, auditLogger('DEVICE_BULK_DELETE'), bulkDeleteDevices);

router.get('/:id', validateDeviceId, getDeviceById);
router.put('/:id', authorize(['admin']), validateDeviceId, validateUpdateDevice, auditLogger('DEVICE_UPDATE'), updateDevice);
router.delete('/:id', authorize(['admin']), validateDeviceId, auditLogger('DEVICE_DELETE'), deleteDevice);

router.post('/:id/isolate', authorize(['admin' ]), validateDeviceId, auditLogger('DEVICE_ISOLATE'), isolateDevice);
router.post('/:id/unisolate', authorize(['admin' ]), validateDeviceId, auditLogger('DEVICE_UNISOLATE'), unisolateDevice);
router.post('/:id/rollback', authorize(['admin']), validateDeviceId, auditLogger('DEVICE_ROLLBACK'), rollbackDevice);

export default router;
