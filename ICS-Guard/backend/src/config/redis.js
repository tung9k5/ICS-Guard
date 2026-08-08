import { createClient } from 'redis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const caPath = path.resolve(__dirname, '../certs/ca.crt');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
console.log(`[Redis] Configuring connection to: ${REDIS_URL}`);

let realClient = null;
let useFallback = true;

// Dummy mock client to avoid crashes in non-Redis environments
const mockClient = {
  on: (event, handler) => {},
  connect: async () => { console.log('[Redis] Using Mock Redis client.'); },
  sendCommand: async () => null,
  get: async () => null,
  setEx: async () => {},
  del: async () => {},
  quit: async () => {}
};

try {
  const isTls = REDIS_URL.startsWith('rediss');
  const socketOptions = {
    connectTimeout: 1000,
    reconnectStrategy: (retries) => {
      if (retries > 1) {
        console.warn('[Redis] Redis not reachable. Switching to Mock Redis client.');
        useFallback = true;
        return false; // Stop reconnecting
      }
      return 500;
    }
  };

  if (isTls) {
    socketOptions.tls = true;
    if (fs.existsSync(caPath)) {
      console.log(`[Redis] Loading CA certificate for secure TLS connection from: ${caPath}`);
      socketOptions.ca = [fs.readFileSync(caPath)];
    } else {
      console.warn(`[Redis] TLS requested but CA certificate is missing at: ${caPath}. Permitting unauthorized fallback.`);
      socketOptions.rejectUnauthorized = false;
    }
  }

  realClient = createClient({
    url: REDIS_URL,
    socket: socketOptions
  });

  realClient.on('error', (err) => {
    // Suppress noise when Redis server is offline
    useFallback = true;
  });

  realClient.on('connect', () => {
    console.log('[Redis] Client connected successfully.');
    useFallback = false;
  });
} catch (err) {
  console.warn('[Redis] Client initialization failed:', err.message);
  useFallback = true;
}

// Wrapper to delegate dynamically
const redisClient = {
  on: (event, handler) => {
    if (realClient && !useFallback) {
      realClient.on(event, handler);
    }
  },
  connect: async () => {
    if (realClient && !useFallback) {
      try {
        await realClient.connect();
      } catch (err) {
        console.warn('[Redis] Connect call failed, using mock client.', err.message);
        useFallback = true;
      }
    } else {
      await mockClient.connect();
    }
  },
  sendCommand: async (args) => {
    const flatArgs = Array.isArray(args[0]) ? args[0] : args;
    if (realClient && !useFallback && realClient.isOpen) {
      try {
        return await realClient.sendCommand(flatArgs);
      } catch (err) {
        console.warn('[Redis] sendCommand failed, using mock fallback.', err.message);
        useFallback = true;
      }
    }
    
    // Fallback Mock Logic
    const cmd = String(flatArgs[0]).toUpperCase();
    const subCmd = flatArgs[1] ? String(flatArgs[1]).toUpperCase() : '';
    
    if (cmd === 'SCRIPT' && subCmd === 'LOAD') {
      return 'mock-sha-hash';
    }
    if (cmd === 'EVALSHA' || cmd === 'EVAL') {
      return [1, 900000];
    }
    if (cmd === 'ZCARD') {
      return '0';
    }
    return null;
  },
  get: async (key) => {
    if (realClient && !useFallback && realClient.isOpen) {
      try {
        return await realClient.get(key);
      } catch (err) {
        useFallback = true;
        return null;
      }
    }
    return null;
  },
  setEx: async (key, seconds, value) => {
    if (realClient && !useFallback && realClient.isOpen) {
      try {
        await realClient.setEx(key, seconds, value);
      } catch (err) {
        useFallback = true;
      }
    }
  },
  del: async (key) => {
    if (realClient && !useFallback && realClient.isOpen) {
      try {
        await realClient.del(key);
      } catch (err) {
        useFallback = true;
      }
    }
  },
  quit: async () => {
    if (realClient && !useFallback && realClient.isOpen) {
      try {
        await realClient.quit();
      } catch (err) {}
    }
  }
};

export default redisClient;
