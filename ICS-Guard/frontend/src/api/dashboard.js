import http from '@/api/httpClient';

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
  },

  getRiskStatus(options = {}) {
    return http({
      url: '/dashboard/risk-status',
      method: 'GET',
      ...options
    });
  }
};
