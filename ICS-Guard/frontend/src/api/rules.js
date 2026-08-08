import http from '@/api/httpClient';

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

  bulkDeleteRules(data, options = {}) {
    return http({
      url: '/rules/bulk-delete',
      method: 'POST',
      data,
      ...options
    });
  },

  backtestRule(data, options = {}) {
    return http({
      url: '/rules/backtest',
      method: 'POST',
      data,
      ...options
    });
  },

  getRuleTemplates(params = {}, options = {}) {
    return http({
      url: '/rules/templates',
      method: 'GET',
      params,
      ...options
    });
  },

  syncRuleTemplates(data = {}, options = {}) {
    return http({
      url: '/rules/templates/sync',
      method: 'POST',
      data,
      ...options
    });
  }
};
