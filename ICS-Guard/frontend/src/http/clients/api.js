import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const http = axios.create({
  baseURL,
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
    const { accessTokenKey } = getAuthKeys();
    const token = localStorage.getItem(accessTokenKey);
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    const { accessTokenKey, refreshTokenKey, loginUrl } = getAuthKeys();
    
    if (error.response?.status === 401 && !originalRequest._retry) {
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

        const { data } = await axios.post(`${baseURL}/v1/auth/refresh`, {
          refresh_token: refreshToken
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
