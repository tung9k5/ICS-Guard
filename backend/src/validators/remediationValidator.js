import { errorResponse } from '../utils/response.js';
import {
  REMEDIATION_ACTION_KEYS,
  REMEDIATION_SESSION_SOURCES,
  SEVERITY_LEVELS,
} from '../constants/index.js';

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const VALID_ACTION_KEYS = Object.values(REMEDIATION_ACTION_KEYS);
const VALID_SOURCES = Object.values(REMEDIATION_SESSION_SOURCES);
const VALID_SEVERITIES = Object.values(SEVERITY_LEVELS);

const validateMongoIdValue = (value, name, res) => {
  if (!value || !MONGO_ID_REGEX.test(value)) {
    errorResponse(res, `Invalid ${name} format`, null, 400);
    return false;
  }
  return true;
};

const validateSteps = (steps, res, { required = false } = {}) => {
  if (steps === undefined) {
    if (required) {
      errorResponse(res, 'steps is required', null, 400);
      return false;
    }
    return true;
  }

  if (!Array.isArray(steps)) {
    errorResponse(res, 'steps must be an array', null, 400);
    return false;
  }

  if (required && steps.length === 0) {
    errorResponse(res, 'steps must not be empty', null, 400);
    return false;
  }

  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object') {
      errorResponse(res, `steps[${index}] must be an object`, null, 400);
      return false;
    }

    const actionKey = step.action_key || step.actionKey;
    if (actionKey && !VALID_ACTION_KEYS.includes(actionKey)) {
      errorResponse(res, `steps[${index}].action_key must be one of: ${VALID_ACTION_KEYS.join(', ')}`, null, 400);
      return false;
    }

    const riskLevel = step.risk_level || step.riskLevel;
    if (riskLevel && !VALID_SEVERITIES.includes(String(riskLevel).toUpperCase())) {
      errorResponse(res, `steps[${index}].risk_level must be one of: ${VALID_SEVERITIES.join(', ')}`, null, 400);
      return false;
    }
  }

  return true;
};

export const validateAvailabilityQuery = (req, res, next) => {
  const incidentId = req.query.incidentId || req.query.incident_id;
  if (incidentId && !MONGO_ID_REGEX.test(incidentId)) {
    return errorResponse(res, 'Invalid incidentId format', null, 400);
  }
  next();
};

export const validateIncidentIdParam = (req, res, next) => {
  if (!validateMongoIdValue(req.params.incidentId, 'incidentId', res)) return;
  next();
};

export const validatePlanIdParam = (req, res, next) => {
  if (!validateMongoIdValue(req.params.planId, 'planId', res)) return;
  next();
};

export const validateStepIdParam = (req, res, next) => {
  if (!validateMongoIdValue(req.params.stepId, 'stepId', res)) return;
  next();
};

export const validateManualDiagnosis = (req, res, next) => {
  const { diagnosis_summary, fault_type, suspected_cause, risk_level, confidence, steps } = req.body;

  if (!diagnosis_summary && !fault_type && !suspected_cause && (!steps || steps.length === 0)) {
    return errorResponse(res, 'diagnosis_summary, fault_type, suspected_cause, or steps is required', null, 400);
  }

  if (risk_level && !VALID_SEVERITIES.includes(String(risk_level).toUpperCase())) {
    return errorResponse(res, `risk_level must be one of: ${VALID_SEVERITIES.join(', ')}`, null, 400);
  }

  if (confidence !== undefined) {
    const parsed = Number(confidence);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return errorResponse(res, 'confidence must be a number between 0 and 1', null, 400);
    }
  }

  if (!validateSteps(steps, res)) return;
  next();
};

export const validateCreatePlan = (req, res, next) => {
  const { source, risk_level, confidence, steps } = req.body;

  if (source && !VALID_SOURCES.includes(source)) {
    return errorResponse(res, `source must be one of: ${VALID_SOURCES.join(', ')}`, null, 400);
  }

  if (risk_level && !VALID_SEVERITIES.includes(String(risk_level).toUpperCase())) {
    return errorResponse(res, `risk_level must be one of: ${VALID_SEVERITIES.join(', ')}`, null, 400);
  }

  if (confidence !== undefined) {
    const parsed = Number(confidence);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
      return errorResponse(res, 'confidence must be a number between 0 and 1', null, 400);
    }
  }

  if (!validateSteps(steps, res)) return;
  next();
};

export const validateCompletePlan = (req, res, next) => {
  const { success, summary } = req.body;

  if (success !== undefined && typeof success !== 'boolean') {
    return errorResponse(res, 'success must be a boolean', null, 400);
  }

  if (summary !== undefined && typeof summary !== 'string') {
    return errorResponse(res, 'summary must be a string', null, 400);
  }

  next();
};
