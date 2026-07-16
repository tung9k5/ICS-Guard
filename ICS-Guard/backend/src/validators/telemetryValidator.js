import { errorResponse } from '../utils/response.js';

export const validateIngestLog = (req, res, next) => {
  const { device_id, log_type, event, source_ip, username, timestamp } = req.body;

  if (!device_id || typeof device_id !== 'string' || device_id.trim() === '') {
    return errorResponse(res, 'device_id is required and must be a non-empty string.', null, 400);
  }

  if (log_type && typeof log_type !== 'string') {
    return errorResponse(res, 'log_type must be a string.', null, 400);
  }

  if (event && typeof event !== 'string') {
    return errorResponse(res, 'event must be a string.', null, 400);
  }

  if (source_ip && typeof source_ip !== 'string') {
    return errorResponse(res, 'source_ip must be a string.', null, 400);
  }

  if (username && typeof username !== 'string') {
    return errorResponse(res, 'username must be a string.', null, 400);
  }
  
  if (timestamp) {
    if (typeof timestamp !== 'string') {
      return errorResponse(res, 'timestamp must be a string.', null, 400);
    }
    const logTime = new Date(timestamp);
    if (isNaN(logTime.getTime())) {
      return errorResponse(res, 'Invalid timestamp format.', null, 400);
    }
  }

  next();
};

export const validateControlAttack = (req, res, next) => {
  const { device_id, attack_type } = req.body;

  if (!device_id || typeof device_id !== 'string') {
    return errorResponse(res, 'device_id is required and must be a string.', null, 400);
  }

  if (!attack_type || typeof attack_type !== 'string') {
    return errorResponse(res, 'attack_type is required and must be a string.', null, 400);
  }

  next();
};
