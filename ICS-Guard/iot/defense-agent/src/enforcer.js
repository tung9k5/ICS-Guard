import { execFile } from 'child_process';
import { promisify } from 'util';
import { appendAuditLog } from './audit.js';

const exec = promisify(execFile);

// Enforcement modes, tried in priority order
const MODE_DOCKER  = 'docker_network';
const MODE_IPTABLES = 'iptables';
const MODE_SIMULATED = 'simulated';

// Detect available enforcement modes at startup
let availableMode = MODE_SIMULATED;

async function detectMode() {
  // Try Docker socket first
  try {
    await exec('docker', ['info', '--format', '{{.ServerVersion}}']);
    availableMode = MODE_DOCKER;
    console.log('[Enforcer] Docker socket available — using docker_network mode');
    return;
  } catch {
    // Docker not available
  }
  // Try iptables
  try {
    await exec('iptables', ['-L', '-n', '--line-numbers']);
    availableMode = MODE_IPTABLES;
    console.log('[Enforcer] iptables available — using iptables mode');
    return;
  } catch {
    // iptables not available
  }
  availableMode = MODE_SIMULATED;
  console.warn('[Enforcer] Neither Docker socket nor iptables available — running in SIMULATED mode (enforcement is logged only)');
}

detectMode();

// ── Docker network enforcement ─────────────────────────────────────────────

async function dockerDisconnect(containerName, networkName = 'ot_network') {
  // The container name in Compose is typically the service name
  // e.g. "ics-guard-simulator-1" or the value of container_name
  const candidates = [
    containerName,
    `ics-guard-${containerName}-1`,
    `ics_guard_${containerName}_1`,
    containerName.replace(/[^a-zA-Z0-9_-]/g, '_'),
  ];

  for (const name of candidates) {
    try {
      await exec('docker', ['network', 'disconnect', '--force', networkName, name]);
      return { container: name, network: networkName };
    } catch {
      // try next candidate
    }
  }
  throw new Error(`Could not find container matching "${containerName}" in network "${networkName}"`);
}

async function dockerConnect(containerName, networkName = 'ot_network') {
  const candidates = [
    containerName,
    `ics-guard-${containerName}-1`,
    `ics_guard_${containerName}_1`,
    containerName.replace(/[^a-zA-Z0-9_-]/g, '_'),
  ];

  for (const name of candidates) {
    try {
      await exec('docker', ['network', 'connect', networkName, name]);
      return { container: name, network: networkName };
    } catch (err) {
      // "already connected" is OK
      if (String(err.message).includes('already exists')) {
        return { container: name, network: networkName, note: 'already_connected' };
      }
    }
  }
  throw new Error(`Could not reconnect container matching "${containerName}" to network "${networkName}"`);
}

// ── iptables enforcement ───────────────────────────────────────────────────

async function iptablesBlock(ipAddress) {
  // Add DROP rules for both ingress and egress
  await exec('iptables', ['-I', 'FORWARD', '-s', ipAddress, '-j', 'DROP']);
  await exec('iptables', ['-I', 'FORWARD', '-d', ipAddress, '-j', 'DROP']);
  // Also block on INPUT/OUTPUT (for host-mode containers)
  try {
    await exec('iptables', ['-I', 'INPUT', '-s', ipAddress, '-j', 'DROP']);
    await exec('iptables', ['-I', 'OUTPUT', '-d', ipAddress, '-j', 'DROP']);
  } catch {
    // Non-fatal if host chains not accessible
  }
  return { rules: ['FORWARD -s DROP', 'FORWARD -d DROP'] };
}

async function iptablesUnblock(ipAddress) {
  const rules = [
    ['-D', 'FORWARD', '-s', ipAddress, '-j', 'DROP'],
    ['-D', 'FORWARD', '-d', ipAddress, '-j', 'DROP'],
    ['-D', 'INPUT',   '-s', ipAddress, '-j', 'DROP'],
    ['-D', 'OUTPUT',  '-d', ipAddress, '-j', 'DROP'],
  ];

  for (const args of rules) {
    try {
      await exec('iptables', args);
    } catch {
      // Rule may not exist — not fatal
    }
  }
  return { removed: rules.length };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Isolate a device: disconnect from network using best available method.
 * @param {object} opts
 * @param {string} opts.device_id
 * @param {string} [opts.container_name]   — Docker container name / service name
 * @param {string} [opts.ip_address]       — IP for iptables fallback
 * @param {string} [opts.network_name]     — Docker network name (default: ot_network)
 * @param {string} [opts.requested_by]
 * @returns {Promise<{status, enforcement, detail}>}
 */
export async function isolateDevice({ device_id, container_name, ip_address, network_name = 'ot_network', requested_by = 'soar' }) {
  const startedAt = new Date().toISOString();
  let enforcement = availableMode;
  let detail = {};

  try {
    if (availableMode === MODE_DOCKER && container_name) {
      detail = await dockerDisconnect(container_name, network_name);
      enforcement = MODE_DOCKER;
    } else if (availableMode === MODE_IPTABLES && ip_address) {
      detail = await iptablesBlock(ip_address);
      enforcement = MODE_IPTABLES;
    } else {
      // Simulated — log only
      detail = { note: 'No real enforcement — Defense Agent running in simulated mode' };
      enforcement = MODE_SIMULATED;
    }

    const result = { status: 'succeeded', enforcement, device_id, detail, applied_at: new Date().toISOString() };
    appendAuditLog({ action: 'isolate', ...result, requested_by, started_at: startedAt });
    return result;
  } catch (err) {
    const result = { status: 'failed', enforcement, device_id, reason: err.message, applied_at: new Date().toISOString() };
    appendAuditLog({ action: 'isolate', ...result, requested_by, started_at: startedAt });
    return result;
  }
}

/**
 * Rollback (re-connect) a device.
 */
export async function rollbackDevice({ device_id, container_name, ip_address, network_name = 'ot_network', requested_by = 'soar' }) {
  const startedAt = new Date().toISOString();
  let enforcement = availableMode;
  let detail = {};

  try {
    if (availableMode === MODE_DOCKER && container_name) {
      detail = await dockerConnect(container_name, network_name);
      enforcement = MODE_DOCKER;
    } else if (availableMode === MODE_IPTABLES && ip_address) {
      detail = await iptablesUnblock(ip_address);
      enforcement = MODE_IPTABLES;
    } else {
      detail = { note: 'No real enforcement — simulated rollback' };
      enforcement = MODE_SIMULATED;
    }

    const result = { status: 'succeeded', enforcement, device_id, detail, applied_at: new Date().toISOString() };
    appendAuditLog({ action: 'rollback', ...result, requested_by, started_at: startedAt });
    return result;
  } catch (err) {
    const result = { status: 'failed', enforcement, device_id, reason: err.message, applied_at: new Date().toISOString() };
    appendAuditLog({ action: 'rollback', ...result, requested_by, started_at: startedAt });
    return result;
  }
}

/**
 * Block a source IP (for playbook block_ip action).
 */
export async function blockSourceIp({ source_ip, requested_by = 'playbook' }) {
  const startedAt = new Date().toISOString();
  let detail = {};

  try {
    if (availableMode === MODE_IPTABLES) {
      await exec('iptables', ['-I', 'FORWARD', '-s', source_ip, '-j', 'DROP']);
      await exec('iptables', ['-I', 'INPUT',   '-s', source_ip, '-j', 'DROP']);
      detail = { rules_applied: 2, target: source_ip };
    } else {
      detail = { note: 'Simulated IP block — no iptables available' };
    }

    const result = { status: 'succeeded', source_ip, detail, applied_at: new Date().toISOString() };
    appendAuditLog({ action: 'block_ip', ...result, requested_by, started_at: startedAt });
    return result;
  } catch (err) {
    const result = { status: 'failed', source_ip, reason: err.message };
    appendAuditLog({ action: 'block_ip', ...result, requested_by, started_at: startedAt });
    return result;
  }
}

export function getEnforcementMode() {
  return availableMode;
}
