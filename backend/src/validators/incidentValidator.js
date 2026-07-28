import { errorResponse } from '../utils/response.js';
import { INCIDENT_STATUSES, SEVERITY_LEVELS } from '../constants/index.js';

const VALID_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_STATUSES = Object.values(INCIDENT_STATUSES);

export const validateCreateIncident = (req, res, next) => {
  const { title, description, severity, status } = req.body;

  if (!title || !description) {
    return errorResponse(res, 'Title and description are required', null, 400);
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return errorResponse(res, `Severity must be one of: ${VALID_SEVERITIES.join(', ')}`, null, 400);
  }

  if (status && !VALID_STATUSES.includes(status)) {
    return errorResponse(res, `Status must be one of: ${VALID_STATUSES.join(', ')}`, null, 400);
  }

  next();
};

export const validateUpdateIncident = (req, res, next) => {
  const { status, severity } = req.body;

  if (status && !VALID_STATUSES.includes(status)) {
    return errorResponse(res, `Status must be one of: ${VALID_STATUSES.join(', ')}`, null, 400);
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    return errorResponse(res, `Severity must be one of: ${VALID_SEVERITIES.join(', ')}`, null, 400);
  }

  next();
};
