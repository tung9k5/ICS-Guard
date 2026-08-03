import axios from 'axios';
import { hideGlobalLoading, showGlobalLoading } from '@/utils/loadingEvent';

const SIMULATOR_KEY = import.meta.env.VITE_SIMULATOR_API_KEY || 'ics-guard-simulator-secret-key-2026';

function createTrustEdgeClient(baseURL, tokenKeys, loginUrl) {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: false,
  });

  client.interceptors.request.use(
    (config) => {
      showGlobalLoading();
      const token = tokenKeys.map((key) => localStorage.getItem(key)).find(Boolean);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error) => {
      hideGlobalLoading();
      return Promise.reject(error);
    }
  );

  client.interceptors.response.use(
    (response) => {
      hideGlobalLoading();
      return response.data;
    },
    (error) => {
      hideGlobalLoading();
      return Promise.reject(error);
    }
  );

  return client;
}

// Hardware simulator → backend /api (proxied via /hardware-api → port 8000)
export const hardwareApi = createTrustEdgeClient(
  '/api',
  ['access_token'],
  '/login'
);

// Attack console → standalone Attack Adapter (proxied via /attack-api → port 5003)
export const attackApi = createTrustEdgeClient(
  '/attack-api',
  ['attacker_access_token', 'access_token'],
  '/login'
);
