import { errorResponse } from '../utils/response.js';
import { IP_REGEX } from '../utils/regex.js';

export const validateUnblockIp = (req, res, next) => {
  const { ipAddress } = req.body;
  if (!ipAddress) {
    return errorResponse(res, 'ipAddress is required', null, 400);
  }

  if (!IP_REGEX.test(ipAddress.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  next();
};
