import http from '@/http/clients/api';

export default {
  getAllUsers(options = {}) {
    return http({
      url: '/users',
      method: 'GET',
      ...options
    });
  },

  getUserById(id, options = {}) {
    return http({
      url: `/users/${id}`,
      method: 'GET',
      ...options
    });
  },

  updateProfile(data, options = {}) {
    return http({
      url: '/users/profile',
      method: 'PUT',
      data,
      ...options
    });
  },

  updateUser(id, data, options = {}) {
    return http({
      url: `/users/${id}`,
      method: 'PUT',
      data,
      ...options
    });
  },
  
  deleteUser(id, options = {}) {
    return http({
      url: `/users/${id}`,
      method: 'DELETE',
      ...options
    });
  }
};
