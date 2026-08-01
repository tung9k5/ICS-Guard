import axios from 'axios';
import { showGlobalLoading, hideGlobalLoading } from '@/utils/loadingEvent';
import { AUTH_KEYS } from '@/constants/authConstants';
import { store } from '@/store';
import { setToken } from '@/store/slices/authSlice';

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

const baseURL = import.meta.env.VITE_API_URL;

const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getLoginUrl = () => {
  const isAttacker = window.location.pathname.startsWith('/attacker');
  return isAttacker ? '/attacker/login' : '/login';
};

http.interceptors.request.use(
  async (config) => {
    if (!config.hideLoading) {
      showGlobalLoading();
    }
    if (config.url && !config.url.includes('/auth/')) {
      const token = store?.getState()?.auth?.token;
      if (token) {
        const payload = parseJwt(token);
        if (payload && payload.exp) {
          const expTime = payload.exp * 1000;
          const nowTime = Date.now();
          
          if (expTime - nowTime < 60000) {
            if (isRefreshing) {
              await new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
              });
            } else {
              isRefreshing = true;
              try {
                const response = await axios.post(`${baseURL}/auth/refresh`, {}, { withCredentials: true });
                store.dispatch(setToken(response.data.accessToken));
                processQueue(null, response.data.accessToken);
              } catch (err) {
                processQueue(err, null);
              } finally {
                isRefreshing = false;
              }
            }
          }
        }
      }
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
    const loginUrl = getLoginUrl();
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url.includes('/auth/refresh') ||
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/google') ||
        originalRequest.url.includes('/auth/register')
      ) {
        if (originalRequest.url.includes('/auth/refresh')) {
          if (!originalRequest._silent && !window.location.pathname.includes('/login') && !window.location.pathname.includes('/register')) {
            window.location.href = loginUrl;
          }
        }
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
