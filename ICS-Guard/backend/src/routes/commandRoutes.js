import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { getCommandStatus } from '../controllers/commandController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/:id', authorize(['admin', 'analyst', 'device_management']), getCommandStatus);

export default router;
