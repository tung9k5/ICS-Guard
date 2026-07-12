import http from '@/http/clients/api';

export default {
  getDevices(params = {}, options = {}) {
    return http({
      url: '/attacks/devices',
      method: 'GET',
      params,
      ...options
    });
  },

  launchAttack(deviceId, attackType, options = {}) {
    return http({
      url: '/attacks/launch',
      method: 'POST',
      data: {
        device_id: deviceId,
        attack_type: attackType
      },
      ...options
    });
  }
};
