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
      config.headers['X-Simulator-API-Key'] = SIMULATOR_KEY;
      config.headers['x-simulator-api-key'] = SIMULATOR_KEY;
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

// Hardware simulator → Hardware BFF (proxied via /hardware-api → port 5001)
export const hardwareApi = createTrustEdgeClient(
  '/hardware-api',
  ['access_token'],
  '/login'
);

hardwareApi.defaults.headers.common = hardwareApi.defaults.headers.common || {};
hardwareApi.defaults.headers.common['X-Simulator-API-Key'] = SIMULATOR_KEY;
hardwareApi.defaults.headers.common['x-simulator-api-key'] = SIMULATOR_KEY;

// Attack console → standalone Attack Adapter (proxied via /attack-api → port 5003)
export const attackApi = createTrustEdgeClient(
  '/attack-api',
  ['attacker_access_token', 'access_token'],
  '/login'
);

// Add simulator authorization header so attack adapter accepts requests from the web simulator
attackApi.defaults.headers.common = attackApi.defaults.headers.common || {};
attackApi.defaults.headers.common['X-Simulator-API-Key'] = SIMULATOR_KEY;
attackApi.defaults.headers.common['x-simulator-api-key'] = SIMULATOR_KEY;
