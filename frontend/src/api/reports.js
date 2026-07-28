import http from '@/http/clients/api';

export default {
  getSummary(params = {}, options = {}) {
    return http({
      url: '/reports/summary',
      method: 'GET',
      params,
      ...options
    });
  }
};
