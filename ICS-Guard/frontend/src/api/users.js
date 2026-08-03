import http from '@/api/httpClient';

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
  
  createUser(data, options = {}) {
    return http({
      url: '/users',
      method: 'POST',
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
  },

  restoreUser(id, options = {}) {
    return http({
      url: `/users/${id}/restore`,
      method: 'POST',
      ...options
    });
  },

  getPendingDeletions(options = {}) {
    return http({
      url: '/users/pending-deletions',
      method: 'GET',
      ...options
    });
  }
};

