import http from '@/http/clients/api';

export default {
  getAll(params = {}, options = {}) {
    return http({
      url: '/devices',
      method: 'GET',
      params,
      ...options
    });
  },

  getById(id, options = {}) {
    return http({
      url: `/devices/${id}`,
      method: 'GET',
      ...options
    });
  },

  create(data, options = {}) {
    return http({
      url: '/devices',
      method: 'POST',
      data,
      ...options
    });
  },

  update(id, data, options = {}) {
    return http({
      url: `/devices/${id}`,
      method: 'PUT',
      data,
      ...options
    });
  },

  delete(id, options = {}) {
    return http({
      url: `/devices/${id}`,
      method: 'DELETE',
      ...options
    });
  },

  isolate(id) {
    return http.post(`/devices/${id}/isolate`);
  },

  unisolate(id) {
    return http.post(`/devices/${id}/unisolate`);
  },

  rollback(id) {
    return http.post(`/devices/${id}/rollback`);
  },

  deleteMultiple(ids, options = {}) {
    return http({
      url: '/devices/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  }
};

