import http from '@/http/clients/api';

export default {
  getCustomerSummary(options = {}) {
    return http({
      url: '/dashboard/customer-summary',
      method: 'GET',
      ...options
    });
  }
};
