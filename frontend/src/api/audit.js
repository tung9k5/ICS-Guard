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
  },

  deleteLog(id, options = {}) {
    return http({
      url: `/audits/logs/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  bulkDeleteLogs(ids, options = {}) {
    return http({
      url: '/audits/logs/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  }
};
