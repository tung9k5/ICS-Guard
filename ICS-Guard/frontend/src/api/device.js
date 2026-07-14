import http from '@/http/clients/api';

const deviceService = {

  getAll(params) {
    return http.get('/devices', { params });
  },

  getById(id) {
    return http.get(`/devices/${id}`);
  },

  create(data) {
    return http.post('/devices', data);
  },

  update(id, data) {
    return http.put(`/devices/${id}`, data);
  },

  delete(id) {
    return http.delete(`/devices/${id}`);
  },

  isolate(id) {
    return http.post(`/devices/${id}/isolate`);
  },

  unisolate(id) {
    return http.post(`/devices/${id}/unisolate`);
  },

  rollback(id) {
    return http.post(`/devices/${id}/rollback`);
  }
};

export default deviceService;
