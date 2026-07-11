import http from '@/http/clients/api';

export default {
  getAllUsers(params = {}, options = {}) {
    return http({
      url: '/users',
      method: 'GET',
      params,
      ...options
    });
  },

  createUser(data, options = {}) {
    return http({
      url: '/users',
      method: 'POST',
      data,
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
  },
  
  deleteMultipleUsers(ids, options = {}) {
    return http({
      url: '/users/bulk-delete',
      method: 'POST',
      data: { ids },
      ...options
    });
  }
};
