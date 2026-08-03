import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import {
  exactOriginCors,
  parseAllowedOrigins,
  requireBearer,
} from './security.js';

const DEFAULT_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://hardware.local',
  'https://soc.local',
].join(',');

const READ_ROLES = [
  'admin',
  'analyst',
  'device_management',
  'l2_responder',
  'ot_operator',
  'viewer',
];
const WRITE_ROLES = ['admin', 'device_management'];

function requiredSecret(name) {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} is required and must contain at least 32 characters`);
  }
  return value;
}

function runtimeError(res, error, action) {
  const status = error.response?.status;
  const safeStatus = [400, 404, 409, 422].includes(status) ? status : 502;
  const upstreamMessage = error.response?.data?.message || error.response?.data?.error;
  return res.status(safeStatus).json({
    error: safeStatus === 502 ? 'runtime_unavailable' : 'runtime_rejected_request',
    message: safeStatus === 502 ? `Python runtime could not ${action}` : String(upstreamMessage || `Unable to ${action}`),
  });
}

function safeId(req, res, next) {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(req.params.id || '')) {
    return res.status(400).json({ error: 'invalid_id', message: 'The device id is invalid' });
  }
  return next();
}

function unwrapDevice(body) {
  return body?.device || body?.data || body;
}

function unwrapDevices(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.devices)) return body.devices;
  return [];
}

export function createApp(config) {
  const app = express();
  const authOptions = {
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  };
  const readAuth = requireBearer(authOptions, READ_ROLES);
  const writeAuth = requireBearer(authOptions, WRITE_ROLES);
  const runtime = axios.create({
    baseURL: config.runtimeUrl,
    timeout: 5000,
    headers: {
      'X-Runtime-Service-Key': config.runtimeServiceKey,
      Accept: 'application/json',
    },
  });

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(cors(exactOriginCors(config.allowedOrigins)));
  app.use(express.json({ limit: '64kb', strict: true }));

  app.get('/health/live', (req, res) => {
    res.json({ status: 'ok', service: 'ics-guard-hardware-bff' });
  });

  app.get('/health', async (req, res) => {
    try {
      await runtime.get('/health');
      return res.json({ status: 'ready', runtime: 'reachable' });
    } catch {
      return res.status(503).json({ status: 'not_ready', runtime: 'unreachable' });
    }
  });

  app.get('/api/devices', readAuth, async (req, res) => {
    try {
      const response = await runtime.get('/api/plant/devices');
      return res.json({ status: 'success', data: unwrapDevices(response.data) });
    } catch (error) {
      return runtimeError(res, error, 'list devices');
    }
  });

  app.post('/api/devices', writeAuth, async (req, res) => {
    try {
      const response = await runtime.post('/api/plant/devices', req.body);
      const device = unwrapDevice(response.data);
      return res.status(201).json({ status: 'success', data: device, device });
    } catch (error) {
      return runtimeError(res, error, 'create the device');
    }
  });

  app.put('/api/devices/:id', writeAuth, safeId, async (req, res) => {
    try {
      const response = await runtime.put(`/api/plant/devices/${encodeURIComponent(req.params.id)}`, req.body);
      const device = unwrapDevice(response.data);
      return res.json({ status: 'success', data: device, device });
    } catch (error) {
      return runtimeError(res, error, 'update the device');
    }
  });

  app.patch('/api/devices/:id/operational-status', writeAuth, safeId, async (req, res) => {
    try {
      const response = await runtime.patch(
        `/api/plant/devices/${encodeURIComponent(req.params.id)}/operational-status`,
        { operational_status: req.body?.operational_status }
      );
      const device = unwrapDevice(response.data);
      return res.json({ status: 'success', data: device, device });
    } catch (error) {
      return runtimeError(res, error, 'change device status');
    }
  });

  app.delete('/api/devices/:id', writeAuth, safeId, async (req, res) => {
    try {
      await runtime.delete(`/api/plant/devices/${encodeURIComponent(req.params.id)}`);
      return res.json({ status: 'success', message: 'Device deleted from PlantDB' });
    } catch (error) {
      return runtimeError(res, error, 'delete the device');
    }
  });

  app.use((error, req, res, next) => {
    if (error?.status === 403) {
      return res.status(403).json({ error: 'cors_denied', message: 'Request origin is not allowed' });
    }
    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON' });
    }
    return next(error);
  });

  return app;
}

const config = {
  jwtSecret: requiredSecret('JWT_ACCESS_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER || undefined,
  jwtAudience: process.env.JWT_AUDIENCE || undefined,
  runtimeServiceKey: requiredSecret('HARDWARE_RUNTIME_SERVICE_KEY'),
  runtimeUrl: process.env.PYTHON_RUNTIME_URL || 'http://simulator:5002',
  allowedOrigins: parseAllowedOrigins(process.env.HARDWARE_ALLOWED_ORIGINS || DEFAULT_ORIGINS),
};

const app = createApp(config);
const port = Number.parseInt(process.env.HARDWARE_BFF_PORT || '5001', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`[HardwareBFF] listening on ${port}`);
});

export default app;
