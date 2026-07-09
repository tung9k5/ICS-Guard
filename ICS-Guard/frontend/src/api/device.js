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
  }
};

export default deviceService;
