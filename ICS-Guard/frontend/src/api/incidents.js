import http from '@/http/clients/api';

export default {
  getAll(params = {}, options = {}) {
    return http({
      url: '/incidents',
      method: 'GET',
      params,
      ...options
    });
  },

  getById(id, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'GET',
      ...options
    });
  },

  createIncident(data, options = {}) {
    return http({
      url: '/incidents',
      method: 'POST',
      data,
      ...options
    });
  },

  update(id, data, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'PUT',
      data,
      ...options
    });
  },

  delete(id, options = {}) {
    return http({
      url: `/incidents/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  deleteMultiple(ids, options = {}) {
    return http({
      url: '/incidents/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  },

  triggerAiAnalysis(id, options = {}) {
    return http({
      url: `/incidents/${id}/ai-analyze`,
      method: 'POST',
      ...options
    });
  }
};
