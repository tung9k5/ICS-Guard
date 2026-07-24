import { errorResponse } from '../utils/response.js';
import { ALERT_STATUSES } from '../constants/index.js';

const VALID_STATUSES = Object.values(ALERT_STATUSES);

export const validateUpdateAlertStatus = (req, res, next) => {
  const { status } = req.body;

  if (!status || !VALID_STATUSES.includes(status)) {
    return errorResponse(res, `Invalid status provided. Must be one of: ${VALID_STATUSES.join(', ')}`, null, 400);
  }
  next();
};
