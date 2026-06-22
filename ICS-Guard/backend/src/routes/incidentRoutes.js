import express from 'express';
import { getAllIncidents, getIncidentById, triggerAiAnalysis } from '../controllers/incidentController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';

const router = express.Router();

// All incident routes require authentication
router.use(authMiddleware);

router.get('/', authorize(['admin', 'analyst', 'viewer']), getAllIncidents);
router.get('/:id', authorize(['admin', 'analyst', 'viewer']), getIncidentById);
router.post('/:id/ai-analyze', authorize(['admin', 'analyst']), triggerAiAnalysis);

export default router;
