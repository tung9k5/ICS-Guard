import express from 'express';
import {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  deleteAlert,
  deleteMultipleAlerts,
  getCorrelatedAlerts,
  getAlertAiTriage,
  containAlertAsset
} from '../controllers/alertController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAllAlerts);
router.get('/correlated', getCorrelatedAlerts);
router.get('/:id', getAlertById);
router.get('/:id/ai-triage', authorize(['admin', 'analyst']), getAlertAiTriage);
router.post('/:id/contain', authorize(['admin', 'analyst']), auditLogger('ALERT_CONTAINMENT'), containAlertAsset);

router.patch('/:id/status', authorize(['admin', 'analyst']), auditLogger('ALERT_UPDATE_STATUS'), updateAlertStatus);
router.delete('/:id', authorize(['admin', 'analyst']), auditLogger('ALERT_DELETE'), deleteAlert);
router.post('/bulk-delete', authorize(['admin', 'analyst']), auditLogger('ALERT_BULK_DELETE'), deleteMultipleAlerts);

export default router;
