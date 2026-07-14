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
  
  const validNodeTypes = [
    'gateway', 'scada', 'hmi', 'firewall',
    'controller', 'rtu', 'dcs',
    'chip', 'opc_server', 'protocol_bridge', 'camera',
    'sensor', 'sensor_pressure', 'sensor_flow', 'sensor_gas', 'sensor_vibration', 'sensor_level',
    'actuator', 'pump', 'motor', 'breaker', 'alarm'
  ];
  if (data.node_type && !validNodeTypes.includes(data.node_type)) {
    errors.node_type = `Node type must be one of: ${validNodeTypes.join(', ')}`;
  }
  
  const validStatusList = ['active', 'isolated', 'online', 'offline', 'quarantined', 'unprovisioned', 'decommissioned'];
  if (data.status && !validStatusList.includes(data.status)) {
    errors.status = `Status must be one of: ${validStatusList.join(', ')}`;
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export default validateDevice;
