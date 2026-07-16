import http from '@/http/clients/api';

export default {
  login(data, options = {}) {
    return http({
      url: '/auth/login',
      method: 'POST',
      data,
      ...options
    });
  },

  loginGoogle(data, options = {}) {
    return http({
      url: '/auth/google',
      method: 'POST',
      data,
      ...options
    });
  },

  refreshToken(data, options = {}) {
    return http({
      url: '/auth/refresh',
      method: 'POST',
      data,
      ...options
    });
  },

  register(data, options = {}) {
    return http({
      url: '/auth/register',
      method: 'POST',
      data,
      ...options
    });
  },

  logout(data, options = {}) {
    return http({
      url: '/auth/logout',
      method: 'POST',
      data,
      ...options
    });
  },

  setupOnboarding(data, options = {}) {
    return http({
      url: '/auth/setup-onboarding',
      method: 'POST',
      data,
      ...options
    });
  },

  getProfile(options = {}) {
    return http({
      url: '/auth/me',
      method: 'GET',
      ...options
    });
  },
};
