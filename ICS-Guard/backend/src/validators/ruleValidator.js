import { errorResponse } from '../utils/response.js';

export const validateCreateRule = (req, res, next) => {
  const { rule_name, time_window_seconds, trigger_count, severity } = req.body;

  if (!rule_name || !time_window_seconds || !trigger_count) {
    return errorResponse(res, 'rule_name, time_window_seconds, and trigger_count are required', null, 400);
  }

  if (isNaN(parseInt(time_window_seconds, 10)) || parseInt(time_window_seconds, 10) <= 0) {
    return errorResponse(res, 'time_window_seconds must be a positive number', null, 400);
  }

  if (isNaN(parseInt(trigger_count, 10)) || parseInt(trigger_count, 10) <= 0) {
    return errorResponse(res, 'trigger_count must be a positive number', null, 400);
  }

  if (severity) {
    const validSeverities = ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return errorResponse(res, `Severity must be one of: ${validSeverities.join(', ')}`, null, 400);
    }
  }

  next();
};

export const validateUpdateRule = (req, res, next) => {
  const { time_window_seconds, trigger_count, severity } = req.body;

  if (time_window_seconds !== undefined) {
    if (isNaN(parseInt(time_window_seconds, 10)) || parseInt(time_window_seconds, 10) <= 0) {
      return errorResponse(res, 'time_window_seconds must be a positive number', null, 400);
    }
  }

  if (trigger_count !== undefined) {
    if (isNaN(parseInt(trigger_count, 10)) || parseInt(trigger_count, 10) <= 0) {
      return errorResponse(res, 'trigger_count must be a positive number', null, 400);
    }
  }
  
  if (severity) {
    const validSeverities = ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return errorResponse(res, `Severity must be one of: ${validSeverities.join(', ')}`, null, 400);
    }
  }

  next();
};
