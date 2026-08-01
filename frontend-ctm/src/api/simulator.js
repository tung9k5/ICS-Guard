import http from '@/http/clients/api';

export default {
  getSimulatorStatus(options = {}) {
    return http({
      url: '/simulator/status',
      method: 'GET',
      ...options
    });
  },

  setDeviceScenario(deviceId, scenario, severity, options = {}) {
    return http({
      url: '/simulator/scenario',
      method: 'POST',
      data: { device_id: deviceId, scenario, severity },
      ...options
    });
  }
};
