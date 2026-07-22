import axios from 'axios';
import { showGlobalLoading, hideGlobalLoading } from '@/utils/loadingEvent';

const baseURL = import.meta.env.VITE_API_URL;

const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to determine auth keys based on current URL path
const getAuthKeys = () => {
  const isAttacker = window.location.pathname.startsWith('/attacker');
  return {
    accessTokenKey: isAttacker ? 'attacker_access_token' : 'access_token',
    refreshTokenKey: isAttacker ? 'attacker_refresh_token' : 'refresh_token',
    loginUrl: isAttacker ? '/attacker/login' : '/login'
  };
};

http.interceptors.request.use(
  (config) => {
    if (!config.hideLoading) {
      showGlobalLoading();
    }
    return config;
  },
  (error) => {
    hideGlobalLoading();
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

http.interceptors.response.use(
  (response) => {
    if (!response.config.hideLoading) {
      hideGlobalLoading();
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    if (originalRequest && !originalRequest.hideLoading) {
      hideGlobalLoading();
    }
    const { loginUrl } = getAuthKeys();
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes('/auth/refresh')) {
        window.location.href = loginUrl;
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            return http(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return http(originalRequest);
      } catch (err) {
        processQueue(err, null);
        window.location.href = loginUrl;
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default http;
