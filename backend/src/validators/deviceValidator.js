import { errorResponse } from '../utils/response.js';

export const validateCreateDevice = (req, res, next) => {
  const { name, ipAddress, ip_address, macAddress, status, type } = req.body;
  const actualIp = ipAddress || ip_address;

  if (!name || !actualIp) {
    return errorResponse(res, 'Name and ipAddress are required', null, 400);
  }

  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (actualIp && !ipRegex.test(actualIp.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (macAddress && !macRegex.test(macAddress.trim())) {
    return errorResponse(res, 'Invalid MAC Address format', null, 400);
  }

  if (status) {
    const validStatuses = ['active', 'inactive', 'isolated', 'online', 'offline', 'quarantined'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
    }
  }

  next();
};

export const validateUpdateDevice = (req, res, next) => {
  const { ipAddress, ip_address, macAddress, status } = req.body;
  const actualIp = ipAddress || ip_address;
  
  if (actualIp) {
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(actualIp.trim())) {
      return errorResponse(res, 'Invalid IP Address format', null, 400);
    }
  }

  if (macAddress) {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress.trim())) {
      return errorResponse(res, 'Invalid MAC Address format', null, 400);
    }
  }

  if (status) {
    const validStatuses = ['active', 'inactive', 'isolated', 'online', 'offline', 'quarantined'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
    }
  }

  next();
};

export const validateDeviceId = (req, res, next) => {
  if (!req.params.id) {
    return errorResponse(res, 'Device ID is required', null, 400);
  }
  next();
};
