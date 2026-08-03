import express from 'express';
import {
  getAllIncidents,
  getIncidentById,
  createIncident,
  triggerAiAnalysis,
  updateIncident,
  deleteIncident,
  deleteMultipleIncidents,
  getIncidentAttackGraph,
  executePlaybookStep,
  getIncidentForensics,
  downloadIncidentPcap,
  generateExecutivePdfReport,
  containIncidentDevice
} from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorize(['admin', 'analyst']), getAllIncidents);
router.get('/:id', authorize(['admin', 'analyst']), getIncidentById);
router.post('/', authorize(['admin', 'analyst']), auditLogger('INCIDENT_CREATE'), createIncident);
router.post('/:id/ai-analyze', authorize(['admin', 'analyst']), auditLogger('INCIDENT_AI_ANALYZE'), triggerAiAnalysis);
router.post('/:id/containment', authorize(['admin', 'analyst']), auditLogger('INCIDENT_CONTAINMENT'), containIncidentDevice);

router.get('/:id/attack-graph', authorize(['admin', 'analyst']), getIncidentAttackGraph);
router.post('/:id/playbook/step', authorize(['admin', 'analyst']), auditLogger('SOAR_PLAYBOOK_STEP'), executePlaybookStep);
router.get('/:id/forensics', authorize(['admin', 'analyst']), getIncidentForensics);
router.get('/:id/pcap', authorize(['admin', 'analyst']), downloadIncidentPcap);
router.get('/:id/export-pdf', authorize(['admin', 'analyst']), generateExecutivePdfReport);

router.put('/:id', authorize(['admin', 'analyst']), auditLogger('INCIDENT_UPDATE'), updateIncident);
router.delete('/:id', authorize(['admin']), auditLogger('INCIDENT_DELETE'), deleteIncident);
router.post('/bulk-delete', authorize(['admin']), auditLogger('INCIDENT_BULK_DELETE'), deleteMultipleIncidents);

export default router;
