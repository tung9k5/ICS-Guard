import axios from 'axios';
import { showGlobalLoading, hideGlobalLoading } from '@/utils/loadingEvent';

const baseURL = import.meta.env.VITE_API_URL;

const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to determine auth keys based on current URL path
const getAuthKeys = () => {
  const isAttacker = window.location.pathname.startsWith('/attacker');
  const isPublicDemo = window.location.pathname === '/' ||
    window.location.pathname.startsWith('/simulator') ||
    window.location.pathname.startsWith('/attacks');
  return {
    accessTokenKey: isAttacker ? 'attacker_access_token' : 'access_token',
    refreshTokenKey: isAttacker ? 'attacker_refresh_token' : 'refresh_token',
    loginUrl: isAttacker ? '/attacker/login' : '/',
    isPublicDemo,
    isAttackDemo: window.location.pathname.startsWith('/attacks')
  };
};

http.interceptors.request.use(
  (config) => {
    showGlobalLoading();
    const { accessTokenKey, isPublicDemo, isAttackDemo } = getAuthKeys();
    const token = localStorage.getItem(accessTokenKey);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    if (localStorage.getItem('attacker_authenticated') === 'true' || isPublicDemo) {
      config.headers['x-simulator-api-key'] = import.meta.env.VITE_SIMULATOR_API_KEY || 'replace_with_simulator_key';
    }
    if (localStorage.getItem('attacker_authenticated') === 'true' || isAttackDemo) {
      config.headers['x-attack-simulator-api-key'] = import.meta.env.VITE_ATTACK_SIMULATOR_API_KEY || 'replace_with_attack_simulator_key';
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
    hideGlobalLoading();
    return response.data;
  },
  async (error) => {
    hideGlobalLoading();
    const originalRequest = error.config;
    const { accessTokenKey, refreshTokenKey, loginUrl, isPublicDemo } = getAuthKeys();
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Public demo surfaces use simulator API keys and must never redirect to a login page.
      if (isPublicDemo) return Promise.reject(error);
      if (originalRequest.url.includes('/auth/refresh')) {
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
        window.location.href = loginUrl;
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = 'Bearer ' + token;
            return http(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem(refreshTokenKey);
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const { data } = await axios.post(`${baseURL}/auth/refresh`, {
          refreshToken: refreshToken
        });
        
        if (data && data.access_token) {
          localStorage.setItem(accessTokenKey, data.access_token);
          if (data.refresh_token) {
            localStorage.setItem(refreshTokenKey, data.refresh_token);
          }
          
          originalRequest.headers['Authorization'] = `Bearer ${data.access_token}`;
          
          processQueue(null, data.access_token);
          
          return http(originalRequest);
        }
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem(accessTokenKey);
        localStorage.removeItem(refreshTokenKey);
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
