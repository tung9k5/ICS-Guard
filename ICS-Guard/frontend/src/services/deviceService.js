import http from '@/http/clients/api';

const deviceService = {
  // Get all registered devices
  getAll(params) {
    return http.get('/devices', { params });
  },

  // Get device details by ID
  getById(id) {
    return http.get(`/devices/${id}`);
  },

  // Register a new device
  create(data) {
    return http.post('/devices', data);
  },

  // Update device configurations
  update(id, data) {
    return http.put(`/devices/${id}`, data);
  },

  // Delete a device registration
  delete(id) {
    return http.delete(`/devices/${id}`);
  }
};

export default deviceService;
