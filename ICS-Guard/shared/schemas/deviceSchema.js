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
  
  const validNodeTypes = ['gateway', 'controller', 'chip', 'sensor', 'actuator'];
  if (data.node_type && !validNodeTypes.includes(data.node_type)) {
    errors.node_type = `Node type must be one of: ${validNodeTypes.join(', ')}`;
  }
  
  const validStatusList = ['active', 'isolated', 'online', 'offline', 'quarantined'];
  if (data.status && !validStatusList.includes(data.status)) {
    errors.status = `Status must be one of: ${validStatusList.join(', ')}`;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default validateDevice;
