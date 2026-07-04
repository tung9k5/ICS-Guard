import http from '@/http/clients/api';

export default {
  login(data, options = {}) {
    return http({
      url: '/v1/auth/login',
      method: 'POST',
      data,
      ...options
    });
  },

  refreshToken(data, options = {}) {
    return http({
      url: '/v1/auth/refresh',
      method: 'POST',
      data,
      ...options
    });
  },

  register(data, options = {}) {
    return http({
      url: '/v1/auth/register',
      method: 'POST',
      data,
      ...options
    });
  },

  logout(data, options = {}) {
    return http({
      url: '/v1/auth/logout',
      method: 'POST',
      data,
      ...options
    });
  },

  setupOnboarding(data, options = {}) {
    return http({
      url: '/v1/auth/setup-onboarding',
      method: 'POST',
      data,
      ...options
    });
  },

  getProfile(options = {}) {
    return Promise.resolve({ 
      data: { 
        username: 'admin_soc', 
        full_name: 'SOC Administrator',
        role: 'admin' 
      } 
    });
  },
};
