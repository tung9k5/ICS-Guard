import { errorResponse } from '../utils/response.js';

export const validateCreateIncident = (req, res, next) => {
  const { title, description, severity, status } = req.body;

  if (!title || !description) {
    return errorResponse(res, 'Title and description are required', null, 400);
  }

  if (severity) {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return errorResponse(res, `Severity must be one of: ${validSeverities.join(', ')}`, null, 400);
    }
  }

  if (status) {
    const validStatuses = ['open', 'investigating', 'remediated', 'closed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
    }
  }

  next();
};

export const validateUpdateIncident = (req, res, next) => {
  const { status, severity } = req.body;

  if (status) {
    const validStatuses = ['open', 'investigating', 'remediated', 'closed'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
    }
  }

  if (severity) {
    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!validSeverities.includes(severity)) {
      return errorResponse(res, `Severity must be one of: ${validSeverities.join(', ')}`, null, 400);
    }
  }

  next();
};
