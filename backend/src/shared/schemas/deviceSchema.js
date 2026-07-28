const VALID_NODE_TYPES = ['gateway', 'controller', 'chip', 'sensor', 'actuator'];
const VALID_STATUS_LIST = ['active', 'inactive', 'isolated', 'online', 'offline', 'quarantined'];

export const validateDevice = (data) => {
  const errors = {};

  if (!data._id || typeof data._id !== 'string' || data._id.trim() === '') {
    errors._id = 'Device ID is required and must be a non-empty string.';
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    errors.name = 'Device name is required and must be a non-empty string.';
  }

  if (!data.ipAddress || typeof data.ipAddress !== 'string' || data.ipAddress.trim() === '') {
    errors.ipAddress = 'IP Address is required.';
  }

  if (!data.macAddress || typeof data.macAddress !== 'string' || data.macAddress.trim() === '') {
    errors.macAddress = 'MAC Address is required.';
  }

  if (data.node_type && !VALID_NODE_TYPES.includes(data.node_type)) {
    errors.node_type = `Node type must be one of: ${VALID_NODE_TYPES.join(', ')}`;
  }

  if (data.status && !VALID_STATUS_LIST.includes(data.status)) {
    errors.status = `Status must be one of: ${VALID_STATUS_LIST.join(', ')}`;
  }

  if (data.battery_level !== undefined && (typeof data.battery_level !== 'number' || data.battery_level < 0 || data.battery_level > 100)) {
    errors.battery_level = 'Battery level must be a number between 0 and 100.';
  }

  if (data.uptime !== undefined && (typeof data.uptime !== 'number' || data.uptime < 0)) {
    errors.uptime = 'Uptime must be a positive number.';
  }

  if (data.tags && !Array.isArray(data.tags)) {
    errors.tags = 'Tags must be an array of strings.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default validateDevice;
