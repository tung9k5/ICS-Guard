import { errorResponse } from '../utils/response.js';

export const validateUnblockIp = (req, res, next) => {
  const { ipAddress } = req.body;
  if (!ipAddress) {
    return errorResponse(res, 'ipAddress is required', null, 400);
  }

  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ipAddress.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  next();
};
