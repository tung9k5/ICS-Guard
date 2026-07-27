import express from 'express';
import { getDeviceCves } from '../controllers/cveController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', authorize(['admin', 'analyst', 'device_management']), getDeviceCves);

export default router;
