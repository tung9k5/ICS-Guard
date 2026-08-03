import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import cors from 'cors';
import express from 'express';
import mqtt from 'mqtt';
import { findScenario, SCENARIO_ALLOWLIST } from './catalog.js';
import {
  exactOriginCors,
  parseAllowedOrigins,
  requireBearer,
} from './security.js';

const DEFAULT_ORIGINS = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'https://attacker.local',
  'https://soc.local',
].join(',');
const READ_ROLES = ['admin', 'analyst', 'device_management', 'l2_responder', 'ot_operator'];
const RUN_ROLES = ['admin', 'analyst', 'device_management'];
const FINAL_STATES = new Set(['stopped', 'completed', 'expired', 'failed', 'rejected']);
const VALID_ACK_STATES = new Set([
  'accepted',
  'running',
  'stopping',
  'stopped',
  'completed',
  'expired',
  'failed',
  'rejected',
]);

function requiredValue(name, minimumLength = 1) {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} is required${minimumLength > 1 ? ` and must contain at least ${minimumLength} characters` : ''}`);
  }
  return value;
}

function unwrapList(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.targets)) return body.targets;
  if (Array.isArray(body?.devices)) return body.devices;
  return [];
}

function cleanText(value, maximumLength = 128) {
  if (value === null || value === undefined) return undefined;
  return String(value).slice(0, maximumLength);
}

export function sanitizeTarget(raw) {
  const id = cleanText(raw?.id ?? raw?._id ?? raw?.device_id);
  if (!id || !/^[A-Za-z0-9._:-]{1,128}$/.test(id)) return null;
  const parentId = cleanText(raw?.parent_id);
  return {
    id,
    _id: id,
    name: cleanText(raw?.name) || id,
    type: cleanText(raw?.type ?? raw?.node_type) || 'unknown',
    node_type: cleanText(raw?.node_type ?? raw?.type) || 'unknown',
    zone: cleanText(raw?.zone) || 'plant',
    status: cleanText(raw?.status ?? raw?.operational_status) || 'unknown',
    operational_status: cleanText(raw?.operational_status ?? raw?.status) || 'unknown',
    runtime_id: cleanText(raw?.runtime_id) || 'hardware-01',
    parent_id: parentId && /^[A-Za-z0-9._:-]{1,128}$/.test(parentId) ? parentId : null,
    icon_path: cleanText(raw?.icon_path, 48),
  };
}

function publicRun(run) {
  return {
    run_id: run.run_id,
    request_id: run.request_id,
    scenario_id: run.scenario_id,
    target_id: run.target_id,
    runtime_id: run.runtime_id,
    state: run.state,
    created_at: run.created_at,
    lease_expires_at: run.lease_expires_at,
    ack_at: run.ack_at,
    message: run.message,
  };
}

function configureMqtt() {
  const mqttUrl = requiredValue('MQTT_URL');
  const parsedUrl = new URL(mqttUrl);
  if (parsedUrl.protocol !== 'mqtts:') {
    throw new Error('MQTT_URL must use mqtts://');
  }

  const caPath = requiredValue('MQTT_CA_PATH');
  return mqtt.connect(mqttUrl, {
    clientId: `attack-adapter-${crypto.randomBytes(6).toString('hex')}`,
    username: requiredValue('ATTACK_MQTT_USER'),
    password: requiredValue('ATTACK_MQTT_PASSWORD', 12),
    ca: fs.readFileSync(caPath),
    rejectUnauthorized: true,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
    clean: true,
  });
}

function publish(client, topic, payload) {
  return new Promise((resolve, reject) => {
    if (!client.connected) return reject(new Error('MQTT broker is not connected'));
    const timeout = setTimeout(() => reject(new Error('MQTT publish acknowledgement timed out')), 5000);
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false }, (error) => {
      clearTimeout(timeout);
      if (error) return reject(error);
      return resolve();
    });
  });
}

const jwtSecret = requiredValue('JWT_ACCESS_SECRET', 32);
const runtimeServiceKey = requiredValue('ATTACK_RUNTIME_SERVICE_KEY', 32);
const runtime = axios.create({
  baseURL: process.env.PYTHON_RUNTIME_URL || 'http://simulator:5002',
  timeout: 5000,
  headers: {
    'X-Runtime-Service-Key': runtimeServiceKey,
    Accept: 'application/json',
  },
});
const mqttClient = configureMqtt();
const runs = new Map();
const activeByTarget = new Map();

async function loadTargets() {
  const response = await runtime.get('/api/plant/targets');
  return unwrapList(response.data).map(sanitizeTarget).filter(Boolean);
}

function releaseTarget(run) {
  if (activeByTarget.get(run.target_id) === run.run_id) {
    activeByTarget.delete(run.target_id);
  }
}

function setRunState(run, state, message) {
  run.state = state;
  run.ack_at = new Date().toISOString();
  if (message) run.message = cleanText(message, 256);
  if (FINAL_STATES.has(state)) releaseTarget(run);
}

mqttClient.on('connect', () => {
  mqttClient.subscribe('lab/v1/acks/#', { qos: 1 }, (error) => {
    if (error) console.error('[AttackAdapter] MQTT ACK subscription failed');
    else console.log('[AttackAdapter] MQTT TLS connection ready');
  });
});
mqttClient.on('error', () => {
  console.error('[AttackAdapter] MQTT connection error');
});
mqttClient.on('message', (topic, buffer) => {
  if (!topic.startsWith('lab/v1/acks/')) return;
  try {
    const ack = JSON.parse(buffer.toString('utf8'));
    const runId = cleanText(ack.run_id ?? ack.request_id);
    const run = runs.get(runId);
    const state = cleanText(ack.state ?? ack.status)?.toLowerCase();
    if (!run || !VALID_ACK_STATES.has(state)) return;
    setRunState(run, state, ack.message);
  } catch {
    console.warn('[AttackAdapter] ignored malformed runtime ACK');
  }
});

setInterval(() => {
  const now = Date.now();
  for (const run of runs.values()) {
    if (!FINAL_STATES.has(run.state) && Date.parse(run.lease_expires_at) <= now) {
      setRunState(run, 'expired', 'The bounded attack lease expired');
    }
  }
}, 1000).unref();

const app = express();
const authOptions = {
  secret: jwtSecret,
  issuer: process.env.JWT_ISSUER || undefined,
  audience: process.env.JWT_AUDIENCE || undefined,
};
const readAuth = requireBearer(authOptions, READ_ROLES);
const runAuth = requireBearer(authOptions, RUN_ROLES);
const adminAuth = requireBearer(authOptions, ['admin']);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(cors(exactOriginCors(parseAllowedOrigins(process.env.ATTACK_ALLOWED_ORIGINS || DEFAULT_ORIGINS))));
app.use(express.json({ limit: '32kb', strict: true }));

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok', service: 'ics-guard-attack-adapter' });
});
app.get('/health', (req, res) => {
  const ready = mqttClient.connected;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', mqtt: ready ? 'connected' : 'disconnected' });
});

app.get('/api/scenarios', readAuth, (req, res) => {
  res.json({ status: 'success', data: SCENARIO_ALLOWLIST });
});

app.get('/api/targets', readAuth, async (req, res) => {
  try {
    const targets = (await loadTargets()).map((target) => ({
      ...target,
      active_run_id: activeByTarget.get(target.id) || null,
    }));
    return res.json({ status: 'success', data: targets });
  } catch {
    return res.status(502).json({ error: 'runtime_unavailable', message: 'Runtime targets are unavailable' });
  }
});

app.get('/api/runs/:id', readAuth, (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found', message: 'Attack run was not found' });
  return res.json({ status: 'success', data: publicRun(run) });
});

app.post('/api/runs', runAuth, async (req, res) => {
  const scenario = findScenario(req.body?.scenario_id);
  const targetId = cleanText(req.body?.target_id);
  if (!scenario || !targetId || !/^[A-Za-z0-9._:-]{1,128}$/.test(targetId)) {
    return res.status(400).json({ error: 'invalid_run', message: 'A canonical scenario_id and valid target_id are required' });
  }
  if (activeByTarget.has(targetId)) {
    return res.status(409).json({ error: 'target_busy', message: 'This target already has an active attack lease' });
  }

  let target;
  try {
    target = (await loadTargets()).find((candidate) => candidate.id === targetId);
  } catch {
    return res.status(502).json({ error: 'runtime_unavailable', message: 'Runtime targets are unavailable' });
  }
  if (!target) {
    return res.status(404).json({ error: 'target_not_found', message: 'The selected runtime target does not exist' });
  }
  if (activeByTarget.has(targetId)) {
    return res.status(409).json({ error: 'target_busy', message: 'This target already has an active attack lease' });
  }

  const requestedDuration = Number.parseInt(req.body?.duration_seconds, 10);
  const duration = Number.isFinite(requestedDuration)
    ? Math.max(1, Math.min(requestedDuration, scenario.max_duration_seconds))
    : scenario.max_duration_seconds;
  const runId = `run-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const now = Date.now();
  const run = {
    run_id: runId,
    request_id: runId,
    scenario_id: scenario.id,
    target_id: target.id,
    runtime_id: target.runtime_id,
    state: 'publishing',
    created_at: new Date(now).toISOString(),
    lease_expires_at: new Date(now + duration * 1000).toISOString(),
    requested_by: req.user.id,
  };
  const payload = {
    run_id: run.run_id,
    request_id: run.request_id,
    scenario_id: run.scenario_id,
    target_id: run.target_id,
    runtime_id: run.runtime_id,
    lease_expires_at: run.lease_expires_at,
    max_duration_seconds: duration,
    catalog_version: 1,
  };
  const topic = `lab/v1/commands/attack/${run.runtime_id}/${run.target_id}`;

  try {
    activeByTarget.set(run.target_id, run.run_id);
    runs.set(run.run_id, run);
    await publish(mqttClient, topic, payload);
    run.state = 'published';
    return res.status(201).json({ status: 'success', data: publicRun(run) });
  } catch {
    setRunState(run, 'failed', 'The MQTT command could not be published');
    return res.status(503).json({ error: 'mqtt_unavailable', message: 'The attack command could not be published' });
  }
});

app.post('/api/runs/:id/stop', runAuth, async (req, res) => {
  const run = runs.get(req.params.id);
  if (!run) return res.status(404).json({ error: 'not_found', message: 'Attack run was not found' });
  if (FINAL_STATES.has(run.state) || run.state === 'stopping') {
    return res.json({ status: 'success', data: publicRun(run), idempotent: true });
  }

  const payload = {
    action: 'stop',
    scenario_id: 'stop',
    run_id: run.run_id,
    request_id: run.request_id,
    runtime_id: run.runtime_id,
    target_id: run.target_id,
  };
  try {
    await publish(mqttClient, `lab/v1/commands/attack/${run.runtime_id}/${run.target_id}`, payload);
    run.state = 'stopping';
    return res.json({ status: 'success', data: publicRun(run) });
  } catch {
    return res.status(503).json({ error: 'mqtt_unavailable', message: 'The stop command could not be published' });
  }
});

app.post('/api/kill-switch', adminAuth, async (req, res) => {
  const stoppable = [...runs.values()].filter(
    (run) => !FINAL_STATES.has(run.state) && run.state !== 'stopping'
  );
  const results = await Promise.allSettled(stoppable.map(async (run) => {
    await publish(mqttClient, `lab/v1/commands/attack/${run.runtime_id}/${run.target_id}`, {
      action: 'stop',
      scenario_id: 'stop',
      run_id: run.run_id,
      request_id: run.request_id,
      runtime_id: run.runtime_id,
      target_id: run.target_id,
    });
    run.state = 'stopping';
    return run.run_id;
  }));
  const failed = results.filter((result) => result.status === 'rejected').length;
  return res.status(failed ? 503 : 200).json({
    status: failed ? 'partial_failure' : 'success',
    stopped: stoppable.length - failed,
    failed,
    idempotent: stoppable.length === 0,
  });
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

const port = Number.parseInt(process.env.ATTACK_ADAPTER_PORT || '5003', 10);
app.listen(port, '0.0.0.0', () => {
  console.log(`[AttackAdapter] listening on ${port}`);
});

export default app;
