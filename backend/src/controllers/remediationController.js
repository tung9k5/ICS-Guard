import remediationService from '../services/remediationService.js';
import { successResponse } from '../utils/response.js';
import { getClientIp } from '../utils/ipHelper.js';
import { HTTP_STATUS } from '../constants/index.js';

export const getAvailability = async (req, res, next) => {
  try {
    const result = await remediationService.getAvailability(req.query, req.user);
    return successResponse(res, result, 'Remediation availability retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const diagnoseIncident = async (req, res, next) => {
  try {
    const result = await remediationService.diagnoseIncident(req.params.incidentId, req.user);
    return successResponse(res, result, 'Remediation diagnosis generated successfully', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const createManualDiagnosis = async (req, res, next) => {
  try {
    const result = await remediationService.createManualDiagnosis(req.params.incidentId, req.body, req.user);
    return successResponse(res, result, 'Manual remediation plan created successfully', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const createPlan = async (req, res, next) => {
  try {
    const result = await remediationService.createPlan(req.params.incidentId, req.body, req.user);
    return successResponse(res, result, 'Remediation plan created successfully', HTTP_STATUS.CREATED);
  } catch (error) {
    next(error);
  }
};

export const listPlans = async (req, res, next) => {
  try {
    const result = await remediationService.listPlans(req.params.incidentId, req.user);
    return successResponse(res, result, 'Remediation plans retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const getPlan = async (req, res, next) => {
  try {
    const result = await remediationService.getPlan(req.params.planId, req.user);
    return successResponse(res, result, 'Remediation plan retrieved successfully');
  } catch (error) {
    next(error);
  }
};

export const approveStep = async (req, res, next) => {
  try {
    const result = await remediationService.approveStep(req.params.planId, req.params.stepId, req.user);
    return successResponse(res, result, 'Remediation step approved successfully');
  } catch (error) {
    next(error);
  }
};

export const executeStep = async (req, res, next) => {
  try {
    const result = await remediationService.executeStep(req.params.planId, req.params.stepId, req.user, {
      ipAddress: getClientIp(req),
    });
    return successResponse(res, result, 'Remediation step executed successfully');
  } catch (error) {
    next(error);
  }
};

export const executeNext = async (req, res, next) => {
  try {
    const result = await remediationService.executeNext(req.params.planId, req.user, {
      ipAddress: getClientIp(req),
    });
    return successResponse(res, result, 'Next remediation step executed successfully');
  } catch (error) {
    next(error);
  }
};

export const executeAuto = async (req, res, next) => {
  try {
    const result = await remediationService.executeAuto(req.params.planId, req.user, {
      ipAddress: getClientIp(req),
    });
    return successResponse(res, result, 'Automatic remediation executed successfully');
  } catch (error) {
    next(error);
  }
};

export const completePlan = async (req, res, next) => {
  try {
    const result = await remediationService.completePlan(req.params.planId, req.body, req.user);
    return successResponse(res, result, 'Remediation plan completed successfully');
  } catch (error) {
    next(error);
  }
};

export const rollbackPlan = async (req, res, next) => {
  try {
    const result = await remediationService.rollbackPlan(req.params.planId, req.user, {
      ipAddress: getClientIp(req),
    });
    return successResponse(res, result, 'Remediation plan rolled back successfully');
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req, res, next) => {
  try {
    const result = await remediationService.getAuditLogs(req.params.planId, req.user);
    return successResponse(res, result, 'Remediation audit logs retrieved successfully');
  } catch (error) {
    next(error);
  }
};
