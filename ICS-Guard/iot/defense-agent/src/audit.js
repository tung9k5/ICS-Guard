import { appendFileSync, mkdirSync } from 'fs';
import path from 'path';

const LOG_DIR  = process.env.AUDIT_LOG_DIR || '/pcap';
const LOG_FILE = path.join(LOG_DIR, 'defense_agent_audit.jsonl');

try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* already exists */ }

/**
 * Append a single JSON line to the audit log.
 * The log is append-only — no deletes, no overwrites.
 * @param {object} entry
 */
export function appendAuditLog(entry) {
  const line = JSON.stringify({ ...entry, _logged_at: new Date().toISOString() }) + '\n';
  try {
    appendFileSync(LOG_FILE, line, 'utf8');
  } catch (err) {
    // Must not crash the main process
    console.error('[Audit] Failed to write audit log:', err.message);
  }
}
