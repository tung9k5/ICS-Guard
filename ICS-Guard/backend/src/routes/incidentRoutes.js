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
  addForensicsArtifact,
  deleteForensicsArtifact,
  downloadIncidentPcap,
  generateExecutivePdfReport,
  containIncidentDevice,
  recoverIncidentDevice,
  verifyAndCloseIncident,
  acceptIncident,
  markFullySafe
} from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/', authorize(['admin', 'analyst']), getAllIncidents);
router.get('/:id', authorize(['admin', 'analyst']), getIncidentById);
router.post('/', authorize(['admin', 'analyst']), auditLogger('INCIDENT_CREATE'), createIncident);
router.post('/:id/accept', authorize(['admin', 'analyst']), auditLogger('INCIDENT_ACCEPT'), acceptIncident);
router.post('/:id/ai-analyze', authorize(['admin', 'analyst']), auditLogger('INCIDENT_AI_ANALYZE'), triggerAiAnalysis);
router.post('/:id/containment', authorize(['admin', 'analyst']), auditLogger('INCIDENT_CONTAINMENT'), containIncidentDevice);
router.post('/:id/recovery', authorize(['admin', 'analyst']), auditLogger('INCIDENT_RECOVERY'), recoverIncidentDevice);
router.post('/:id/verify-close', authorize(['admin', 'analyst']), auditLogger('INCIDENT_VERIFY_CLOSE'), verifyAndCloseIncident);
router.post('/:id/mark-safe', authorize(['admin', 'analyst']), auditLogger('INCIDENT_MARK_SAFE'), markFullySafe);

router.get('/:id/attack-graph', authorize(['admin', 'analyst']), getIncidentAttackGraph);
router.post('/:id/playbook/step', authorize(['admin', 'analyst']), auditLogger('SOAR_PLAYBOOK_STEP'), executePlaybookStep);
router.get('/:id/forensics', authorize(['admin', 'analyst']), getIncidentForensics);
router.post('/:id/forensics', authorize(['admin', 'analyst']), auditLogger('INCIDENT_ADD_ARTIFACT'), addForensicsArtifact);
router.delete('/:id/forensics/:artifactId', authorize(['admin']), auditLogger('INCIDENT_DELETE_ARTIFACT'), deleteForensicsArtifact);
router.get('/:id/pcap', authorize(['admin', 'analyst']), downloadIncidentPcap);
router.get('/:id/export-pdf', authorize(['admin', 'analyst']), generateExecutivePdfReport);

router.put('/:id', authorize(['admin', 'analyst']), auditLogger('INCIDENT_UPDATE'), updateIncident);
router.delete('/:id', authorize(['admin']), auditLogger('INCIDENT_DELETE'), deleteIncident);
router.post('/bulk-delete', authorize(['admin']), auditLogger('INCIDENT_BULK_DELETE'), deleteMultipleIncidents);

export default router;
