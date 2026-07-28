import http from '@/http/clients/api';

export default {
  getAllSettings(params = {}, options = {}) {
    return http({
      url: '/settings',
      method: 'GET',
      params,
      ...options
    });
  },

  updateSetting(key, value, options = {}) {
    return http({
      url: `/settings/${key}`,
      method: 'PUT',
      data: { value },
      ...options
    });
  }
};
