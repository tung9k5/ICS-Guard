import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import { createReadStream, existsSync, mkdirSync } from 'fs';
import { stat } from 'fs/promises';
import path from 'path';
import { appendAuditLog } from './audit.js';

const exec = promisify(execFile);

const PCAP_DIR = process.env.PCAP_DIR || '/pcap';

// Ensure PCAP directory exists
try { mkdirSync(PCAP_DIR, { recursive: true }); } catch { /* already exists */ }

/**
 * Start a tcpdump capture for a given incident.
 * Returns the pcap file path and SHA-256 after capture completes.
 *
 * @param {object} opts
 * @param {string} opts.incident_id
 * @param {string} [opts.ip_address]         — Filter by device IP
 * @param {string} [opts.interface]          — Network interface (default: eth0)
 * @param {number} [opts.duration_seconds]   — How long to capture (default: 60s)
 * @returns {Promise<{pcap_path, sha256, size_bytes, captured_at}>}
 */
export async function startCapture({ incident_id, ip_address, interface: iface = 'eth0', duration_seconds = 60 }) {
  const timestamp = Date.now();
  const filename  = `incident_${incident_id}_${timestamp}.pcap`;
  const pcapPath  = path.join(PCAP_DIR, filename);

  // Build tcpdump filter expression
  // Capture Modbus TCP (port 502 and 5020) and optionally filter by IP
  let filterExpr = 'tcp and (port 502 or port 5020 or port 102)';
  if (ip_address) {
    filterExpr = `host ${ip_address} and (${filterExpr})`;
  }

  appendAuditLog({
    action: 'capture_start',
    incident_id,
    interface: iface,
    filter: filterExpr,
    duration_seconds,
    output: pcapPath,
    started_at: new Date().toISOString(),
  });

  return new Promise((resolve, reject) => {
    // tcpdump args: -i interface, -w output_file, -G duration, -W 1 (single rotation), filter
    const args = [
      '-i', iface,
      '-w', pcapPath,
      '-G', String(duration_seconds),
      '-W', '1',
      '--immediate-mode',
      filterExpr,
    ];

    const proc = spawn('tcpdump', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      // After duration, tcpdump rotates and stops automatically with -W 1
      // But we kill it to be safe
      try { proc.kill('SIGTERM'); } catch { /* already exited */ }
    }, (duration_seconds + 2) * 1000);

    proc.on('close', async (code) => {
      clearTimeout(timeout);

      if (!existsSync(pcapPath)) {
        const err = new Error(`tcpdump did not create output file. stderr: ${stderr}`);
        appendAuditLog({ action: 'capture_failed', incident_id, reason: err.message });
        return reject(err);
      }

      try {
        const sha256 = await computeSHA256(pcapPath);
        const { size } = await stat(pcapPath);
        const result = {
          pcap_path: pcapPath,
          filename,
          sha256,
          size_bytes: size,
          captured_at: new Date().toISOString(),
          interface: iface,
          filter: filterExpr,
          duration_seconds,
        };
        appendAuditLog({ action: 'capture_complete', incident_id, ...result });
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      // tcpdump not available — return a clear error
      appendAuditLog({ action: 'capture_unavailable', incident_id, reason: err.message });
      reject(new Error(`tcpdump not available: ${err.message}`));
    });
  });
}

/**
 * Stream a PCAP file to an HTTP response object.
 * @param {string} filename — just the filename, not full path
 * @param {object} res — Express response
 */
export function streamPcapFile(filename, res) {
  // Sanitize filename — no path traversal
  const safe = path.basename(filename);
  const pcapPath = path.join(PCAP_DIR, safe);

  if (!existsSync(pcapPath)) {
    res.status(404).json({ error: 'pcap_not_found', message: 'PCAP file not found' });
    return;
  }

  res.setHeader('Content-Type', 'application/vnd.tcpdump.pcap');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}"`);
  createReadStream(pcapPath).pipe(res);
}

async function computeSHA256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end',  () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}
