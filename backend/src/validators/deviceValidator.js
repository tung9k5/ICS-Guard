import { errorResponse } from '../utils/response.js';
import { IP_REGEX, MAC_REGEX } from '../utils/regex.js';
import { DEVICE_STATUSES } from '../constants/index.js';

const VALID_DEVICE_STATUSES = Object.values(DEVICE_STATUSES);

export const validateCreateDevice = (req, res, next) => {
  const { name, ipAddress, ip_address, macAddress, status } = req.body;
  const actualIp = ipAddress || ip_address;

  if (!name || !actualIp) {
    return errorResponse(res, 'Name and ipAddress are required', null, 400);
  }

  if (actualIp && !IP_REGEX.test(actualIp.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  if (macAddress && !MAC_REGEX.test(macAddress.trim())) {
    return errorResponse(res, 'Invalid MAC Address format', null, 400);
  }

  if (status && !VALID_DEVICE_STATUSES.includes(status)) {
    return errorResponse(res, `Status must be one of: ${VALID_DEVICE_STATUSES.join(', ')}`, null, 400);
  }

  next();
};

export const validateUpdateDevice = (req, res, next) => {
  const { ipAddress, ip_address, macAddress, status } = req.body;
  const actualIp = ipAddress || ip_address;

  if (actualIp && !IP_REGEX.test(actualIp.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  if (macAddress && !MAC_REGEX.test(macAddress.trim())) {
    return errorResponse(res, 'Invalid MAC Address format', null, 400);
  }

  if (status && !VALID_DEVICE_STATUSES.includes(status)) {
    return errorResponse(res, `Status must be one of: ${VALID_DEVICE_STATUSES.join(', ')}`, null, 400);
  }

  next();
};

export const validateDeviceId = (req, res, next) => {
  if (!req.params.id) {
    return errorResponse(res, 'Device ID is required', null, 400);
  }
  next();
};
