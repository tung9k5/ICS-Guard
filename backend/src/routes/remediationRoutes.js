import express from 'express';
import {
  approveStep,
  completePlan,
  createManualDiagnosis,
  createPlan,
  diagnoseIncident,
  executeAuto,
  executeNext,
  executeStep,
  getAuditLogs,
  getAvailability,
  getPlan,
  listPlans,
  rollbackPlan,
} from '../controllers/remediationController.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import authorize from '../middlewares/rbacMiddleware.js';
import auditLogger from '../middlewares/auditMiddleware.js';
import {
  validateAvailabilityQuery,
  validateCompletePlan,
  validateCreatePlan,
  validateIncidentIdParam,
  validateManualDiagnosis,
  validatePlanIdParam,
  validateStepIdParam,
} from '../validators/remediationValidator.js';

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/availability',
  authorize(['admin', 'customer']),
  validateAvailabilityQuery,
  getAvailability
);

router.post(
  '/incidents/:incidentId/diagnose',
  authorize(['admin', 'customer']),
  validateIncidentIdParam,
  auditLogger('REMEDIATION_DIAGNOSE'),
  diagnoseIncident
);

router.post(
  '/incidents/:incidentId/manual-diagnosis',
  authorize(['admin', 'customer']),
  validateIncidentIdParam,
  validateManualDiagnosis,
  auditLogger('REMEDIATION_MANUAL_DIAGNOSIS'),
  createManualDiagnosis
);

router.post(
  '/incidents/:incidentId/plans',
  authorize(['admin', 'customer']),
  validateIncidentIdParam,
  validateCreatePlan,
  auditLogger('REMEDIATION_PLAN_CREATE'),
  createPlan
);

router.get(
  '/incidents/:incidentId/plans',
  authorize(['admin', 'customer']),
  validateIncidentIdParam,
  listPlans
);

router.get(
  '/plans/:planId',
  authorize(['admin', 'customer']),
  validatePlanIdParam,
  getPlan
);

router.post(
  '/plans/:planId/steps/:stepId/approve',
  authorize(['admin']),
  validatePlanIdParam,
  validateStepIdParam,
  auditLogger('REMEDIATION_STEP_APPROVE'),
  approveStep
);

router.post(
  '/plans/:planId/steps/:stepId/execute',
  authorize(['admin']),
  validatePlanIdParam,
  validateStepIdParam,
  auditLogger('REMEDIATION_STEP_EXECUTE'),
  executeStep
);

router.post(
  '/plans/:planId/execute-next',
  authorize(['admin']),
  validatePlanIdParam,
  auditLogger('REMEDIATION_EXECUTE_NEXT'),
  executeNext
);

router.post(
  '/plans/:planId/execute-auto',
  authorize(['admin']),
  validatePlanIdParam,
  auditLogger('REMEDIATION_EXECUTE_AUTO'),
  executeAuto
);

router.post(
  '/plans/:planId/complete',
  authorize(['admin']),
  validatePlanIdParam,
  validateCompletePlan,
  auditLogger('REMEDIATION_PLAN_COMPLETE'),
  completePlan
);

router.post(
  '/plans/:planId/rollback',
  authorize(['admin']),
  validatePlanIdParam,
  auditLogger('REMEDIATION_PLAN_ROLLBACK'),
  rollbackPlan
);

router.get(
  '/plans/:planId/audit-logs',
  authorize(['admin', 'customer']),
  validatePlanIdParam,
  getAuditLogs
);

export default router;
