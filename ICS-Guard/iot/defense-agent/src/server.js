import 'dotenv/config';
import express from 'express';
import { isolateDevice, rollbackDevice, blockSourceIp, getEnforcementMode } from './enforcer.js';
import { startCapture, streamPcapFile } from './capture.js';
import { appendAuditLog } from './audit.js';

// ── Config ─────────────────────────────────────────────────────────────────
const PORT          = parseInt(process.env.DEFENSE_AGENT_PORT || '5050', 10);
const SERVICE_KEY   = process.env.DEFENSE_AGENT_KEY || '';
const DOCKER_NETWORK = process.env.OT_DOCKER_NETWORK || 'ics-guard_ot_network';

if (!SERVICE_KEY || SERVICE_KEY.length < 32) {
  console.error('[DefenseAgent] DEFENSE_AGENT_KEY must be set and at least 32 characters. Exiting.');
  process.exit(1);
}

// ── Auth Middleware ─────────────────────────────────────────────────────────
function requireServiceKey(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token !== SERVICE_KEY) {
    appendAuditLog({
      action: 'auth_rejected',
      ip: req.ip,
      path: req.path,
      reason: 'invalid_service_key',
    });
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing service key' });
  }
  next();
}

// ── App ─────────────────────────────────────────────────────────────────────
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '16kb', strict: true }));

// ── Health ──────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ics-guard-defense-agent',
    enforcement_mode: getEnforcementMode(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'ok' });
});

// ── Enforce: Isolate ─────────────────────────────────────────────────────────
// POST /api/enforce/isolate
// Body: { device_id, container_name?, ip_address?, network_name?, requested_by? }
app.post('/api/enforce/isolate', requireServiceKey, async (req, res) => {
  const { device_id, container_name, ip_address, network_name, requested_by } = req.body || {};

  if (!device_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'device_id is required' });
  }

  try {
    const result = await isolateDevice({
      device_id,
      container_name: container_name || `simulator`,
      ip_address,
      network_name: network_name || DOCKER_NETWORK,
      requested_by: requested_by || 'soar',
    });

    const httpStatus = result.status === 'succeeded' ? 200 : 503;
    return res.status(httpStatus).json({ status: result.status, data: result });
  } catch (err) {
    console.error('[DefenseAgent] /isolate error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// ── Enforce: Rollback ────────────────────────────────────────────────────────
// POST /api/enforce/rollback
// Body: { device_id, container_name?, ip_address?, network_name?, requested_by? }
app.post('/api/enforce/rollback', requireServiceKey, async (req, res) => {
  const { device_id, container_name, ip_address, network_name, requested_by } = req.body || {};

  if (!device_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'device_id is required' });
  }

  try {
    const result = await rollbackDevice({
      device_id,
      container_name: container_name || `simulator`,
      ip_address,
      network_name: network_name || DOCKER_NETWORK,
      requested_by: requested_by || 'soar',
    });

    const httpStatus = result.status === 'succeeded' ? 200 : 503;
    return res.status(httpStatus).json({ status: result.status, data: result });
  } catch (err) {
    console.error('[DefenseAgent] /rollback error:', err);
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// ── Enforce: Block IP ─────────────────────────────────────────────────────────
// POST /api/enforce/block-ip
// Body: { source_ip, requested_by? }
app.post('/api/enforce/block-ip', requireServiceKey, async (req, res) => {
  const { source_ip, requested_by } = req.body || {};

  if (!source_ip || !/^[\d.]{7,15}$/.test(source_ip)) {
    return res.status(400).json({ error: 'invalid_request', message: 'Valid IPv4 source_ip is required' });
  }

  try {
    const result = await blockSourceIp({ source_ip, requested_by: requested_by || 'playbook' });
    return res.status(result.status === 'succeeded' ? 200 : 503).json({ status: result.status, data: result });
  } catch (err) {
    return res.status(500).json({ error: 'internal_error', message: err.message });
  }
});

// ── Capture: Start PCAP ──────────────────────────────────────────────────────
// POST /api/capture/start
// Body: { incident_id, ip_address?, interface?, duration_seconds? }
// Note: This is async — capture runs in background, result via callback or polling
app.post('/api/capture/start', requireServiceKey, async (req, res) => {
  const { incident_id, ip_address, interface: iface, duration_seconds = 60 } = req.body || {};

  if (!incident_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'incident_id is required' });
  }

  // Clamp duration to safe range
  const duration = Math.max(5, Math.min(Number(duration_seconds) || 60, 300));

  // Respond immediately — capture runs async
  res.status(202).json({
    status: 'accepted',
    incident_id,
    duration_seconds: duration,
    message: 'PCAP capture started. Poll /api/capture/status/:incident_id for result.',
  });

  // Run capture in background
  startCapture({
    incident_id: String(incident_id),
    ip_address,
    interface: iface || process.env.CAPTURE_INTERFACE || 'eth0',
    duration_seconds: duration,
  }).then(result => {
    // Notify backend via callback URL if configured
    const callbackUrl = process.env.BACKEND_CAPTURE_CALLBACK;
    if (callbackUrl) {
      fetch(`${callbackUrl}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Defense-Agent-Key': SERVICE_KEY,
        },
        body: JSON.stringify({ incident_id, ...result }),
      }).catch(err => {
        console.error('[DefenseAgent] Capture callback failed:', err.message);
      });
    }
    console.log(`[DefenseAgent] Capture complete for incident ${incident_id}: ${result.pcap_path}`);
  }).catch(err => {
    console.error(`[DefenseAgent] Capture failed for incident ${incident_id}:`, err.message);
  });
});

// ── Download PCAP ─────────────────────────────────────────────────────────────
// GET /api/capture/download/:filename
app.get('/api/capture/download/:filename', requireServiceKey, (req, res) => {
  streamPcapFile(req.params.filename, res);
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError) {
    return res.status(400).json({ error: 'invalid_json', message: 'Request body must be valid JSON' });
  }
  console.error('[DefenseAgent] Unhandled error:', err);
  return res.status(500).json({ error: 'internal_error', message: 'Unexpected server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[DefenseAgent] Listening on port ${PORT}`);
  console.log(`[DefenseAgent] Enforcement mode: ${getEnforcementMode()}`);
  console.log(`[DefenseAgent] Docker network: ${DOCKER_NETWORK}`);
});

export default app;
