import express from 'express';
import {
  getAllIncidents,
  createIncident,
  getIncidentById,
  updateIncident,
  deleteIncident,
  bulkDeleteIncidents,
  triggerAiAnalysis,
  getAiAnalysisStatus
} from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateCreateIncident,
  validateUpdateIncident
} from '../validators/incidentValidator.js';
import { validateBulkIds, validateMongoId, validatePagination } from '../validators/commonValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', validatePagination, getAllIncidents);
router.post('/', authorize(['admin', 'customer']), validateCreateIncident, auditLogger('INCIDENT_CREATE'), createIncident);
router.post('/bulk-delete', authorize(['admin', 'customer']), validateBulkIds, auditLogger('INCIDENT_BULK_DELETE'), bulkDeleteIncidents);

router.get('/:id', validateMongoId, getIncidentById);
router.put('/:id', authorize(['admin', 'customer']), validateMongoId, validateUpdateIncident, auditLogger('INCIDENT_UPDATE'), updateIncident);
router.delete('/:id', authorize(['admin', 'customer']), validateMongoId, auditLogger('INCIDENT_DELETE'), deleteIncident);

router.post('/:id/ai-analyze', authorize(['admin']), validateMongoId, auditLogger('INCIDENT_AI_ANALYSIS'), triggerAiAnalysis);
router.get('/:id/ai-status', validateMongoId, getAiAnalysisStatus);

export default router;
