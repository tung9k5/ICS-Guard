import http from '@/http/clients/api';

export default {
  getAllRules(params = {}, options = {}) {
    return http({
      url: '/rules',
      method: 'GET',
      params,
      ...options
    });
  },

  getRuleById(id, options = {}) {
    return http({
      url: `/rules/${id}`,
      method: 'GET',
      ...options
    });
  },

  createRule(data, options = {}) {
    return http({
      url: '/rules',
      method: 'POST',
      data,
      ...options
    });
  },

  updateRule(id, data, options = {}) {
    return http({
      url: `/rules/${id}`,
      method: 'PUT',
      data,
      ...options
    });
  },

  deleteRule(id, options = {}) {
    return http({
      url: `/rules/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  deleteMultipleRules(ids, options = {}) {
    return http({
      url: '/rules/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  }
};
