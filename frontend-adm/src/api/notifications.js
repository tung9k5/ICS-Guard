import http from '@/http/clients/api';

export default {
  getAdminLogs(params = {}, options = {}) {
    return http({
      url: '/notifications/admin-logs',
      method: 'GET',
      params,
      hideLoading: true,
      ...options
    });
  },

  getUnreadCount(options = {}) {
    return http({
      url: '/notifications/admin-logs/unread-count',
      method: 'GET',
      hideLoading: true,
      ...options
    });
  },

  markRead(id, options = {}) {
    return http({
      url: `/notifications/admin-logs/${id}/read`,
      method: 'PATCH',
      hideLoading: true,
      ...options
    });
  },

  markAllRead(options = {}) {
    return http({
      url: '/notifications/admin-logs/read-all',
      method: 'PATCH',
      hideLoading: true,
      ...options
    });
  }
};
