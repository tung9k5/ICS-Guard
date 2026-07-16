import express from 'express';
import {
  getAllIncidents,
  createIncident,
  getIncidentById,
  updateIncident,
  deleteIncident,
  bulkDeleteIncidents,
  triggerAiAnalysis
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
router.post('/', authorize(['admin', 'l1_analyst', 'l2_responder', 'l3_manager']), validateCreateIncident, auditLogger('INCIDENT_CREATE'), createIncident);
router.post('/bulk-delete', authorize(['admin', 'l3_manager']), validateBulkIds, auditLogger('INCIDENT_BULK_DELETE'), bulkDeleteIncidents);

router.get('/:id', validateMongoId, getIncidentById);
router.put('/:id', authorize(['admin', 'l2_responder', 'l3_manager']), validateMongoId, validateUpdateIncident, auditLogger('INCIDENT_UPDATE'), updateIncident);
router.delete('/:id', authorize(['admin', 'l3_manager']), validateMongoId, auditLogger('INCIDENT_DELETE'), deleteIncident);

router.post('/:id/analyze', authorize(['admin', 'l1_analyst', 'l2_responder', 'l3_manager']), validateMongoId, auditLogger('INCIDENT_AI_ANALYSIS'), triggerAiAnalysis);

export default router;
