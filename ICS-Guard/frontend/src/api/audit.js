import http from '@/http/clients/api';

export default {
  getLogs(params = {}, options = {}) {
    return http({
      url: '/audits/logs',
      method: 'GET',
      params,
      ...options
    });
  },

  getBlockedIps(params = {}, options = {}) {
    return http({
      url: '/audits/blocked-ips',
      method: 'GET',
      params,
      ...options
    });
  },

  unblockIp(ipAddress, options = {}) {
    return http({
      url: '/audits/unblock-ip',
      method: 'POST',
      data: { ipAddress },
      ...options
    });
  }
};
