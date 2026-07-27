import express from 'express';
import {
  getSystemHealth,
  getThreatActivity,
  getNetworkTraffic,
  getRiskStatus
} from '../controllers/dashboardController.js';
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

// Apply auth middleware to all dashboard routes
router.use(authMiddleware);

router.get('/system-health', getSystemHealth);
router.get('/threat-activity', getThreatActivity);
router.get('/network-traffic', getNetworkTraffic);
router.get('/risk-status', getRiskStatus);

export default router;
