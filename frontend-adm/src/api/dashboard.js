import http from '@/http/clients/api';

export default {
  getSystemHealth(options = {}) {
    return http({
      url: '/dashboard/system-health',
      method: 'GET',
      ...options
    });
  },

  getThreatActivity(options = {}) {
    return http({
      url: '/dashboard/threat-activity',
      method: 'GET',
      ...options
    });
  },

  getNetworkTraffic(options = {}) {
    return http({
      url: '/dashboard/network-traffic',
      method: 'GET',
      ...options
    });
  }
};
