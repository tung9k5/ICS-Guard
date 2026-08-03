import express from 'express';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import {
  createOrUpdateDraft,
  applyDraft,
  getRuntimeActivePolicy,
} from '../controllers/otPolicyController.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/active', authorize(['admin', 'analyst', 'device_management']), getRuntimeActivePolicy);
router.post('/draft', authorize(['admin', 'device_management']), createOrUpdateDraft);
router.post('/:id/apply', authorize(['admin', 'device_management']), applyDraft);

export default router;
