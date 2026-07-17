import http from '@/http/clients/api';

export default {
  getAllAlerts(params = {}, options = {}) {
    return http({
      url: '/alerts',
      method: 'GET',
      params,
      ...options
    });
  },

  getAlertById(id, options = {}) {
    return http({
      url: `/alerts/${id}`,
      method: 'GET',
      ...options
    });
  },

  updateAlertStatus(id, status, options = {}) {
    return http({
      url: `/alerts/${id}/status`,
      method: 'PATCH',
      data: { status },
      ...options
    });
  },

  deleteAlert(id, options = {}) {
    return http({
      url: `/alerts/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  deleteMultipleAlerts(ids, options = {}) {
    return http({
      url: '/alerts/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  }
};
