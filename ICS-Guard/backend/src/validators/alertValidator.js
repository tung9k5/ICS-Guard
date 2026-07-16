import { errorResponse } from '../utils/response.js';

export const validateUpdateAlertStatus = (req, res, next) => {
  const { status } = req.body;
  const validStatuses = ['new', 'acknowledged', 'resolved', 'false_positive'];
  
  if (!status || !validStatuses.includes(status)) {
    return errorResponse(res, `Invalid status provided. Must be one of: ${validStatuses.join(', ')}`, null, 400);
  }
  next();
};
