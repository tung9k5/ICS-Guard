import crypto from 'crypto';

export const MQTT_TOPICS = {
  TELEMETRY: (runtimeId = '+', deviceId = '+') => `ics/v1/telemetry/${runtimeId}/${deviceId}`,
  HARDWARE_SNAPSHOT: (runtimeId = '+') => `ics/v1/hardware/snapshot/${runtimeId}`,
  SECURITY_COMMAND: (runtimeId = '+', deviceId = '+') => `ics/v1/commands/security/${runtimeId}/${deviceId}`,
  SOC_ACK: (runtimeId = '+', commandId = '+') => `ics/v1/acks/${runtimeId}/${commandId}`,
  ATTACK_COMMAND: (runtimeId = '+', deviceId = '+') => `lab/v1/commands/attack/${runtimeId}/${deviceId}`,
  GROUND_TRUTH_ACK: (runtimeId = '+', requestId = '+') => `lab/v1/acks/${runtimeId}/${requestId}`,
  POLICY_COMMAND: (runtimeId = '+') => `ics/v1/commands/policy/${runtimeId}`
};

export const SECURITY_STATUSES = {
  NORMAL: 'normal',
  ISOLATION_PENDING: 'isolation_pending',
  ISOLATED: 'isolated',
  ROLLBACK_PENDING: 'rollback_pending',
  RECONCILIATION_REQUIRED: 'reconciliation_required'
};

export const OPERATIONAL_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ONLINE: 'online',
  OFFLINE: 'offline',
  DECOMMISSIONED: 'decommissioned'
};

const canonicalizeValue = (value, path = []) => {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON does not permit NaN or Infinity.');
    }
    return value;
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => canonicalizeValue(item, [...path, String(index)]));
    if (path[path.length - 1] === 'devices') {
      const ids = new Set();
      for (const item of items) {
        const id = item?.device_id || item?._id;
        if (!id || ids.has(id)) {
          throw new TypeError('Snapshot devices must have unique device_id values.');
        }
        ids.add(id);
      }
      items.sort((left, right) => {
        const leftId = left.device_id || left._id;
        const rightId = right.device_id || right._id;
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });
    }
    return items;
  }
  if (typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined || typeof child === 'bigint' || typeof child === 'function') {
        throw new TypeError(`Unsupported canonical JSON value at ${[...path, key].join('.')}.`);
      }
      sorted[key] = canonicalizeValue(child, [...path, key]);
    }
    return sorted;
  }
  throw new TypeError(`Unsupported canonical JSON value at ${path.join('.') || '<root>'}.`);
};

export const canonicalizeSnapshot = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Snapshot payload must be an object.');
  }
  const copy = { ...payload };
  delete copy.checksum;
  return canonicalizeValue(copy);
};

/**
 * Canonical snapshot contract: UTF-8/NFC, recursively sorted object keys,
 * compact JSON, and devices sorted by their stable device_id.
 */
export const calculateCanonicalChecksum = (payload) => {
  const jsonString = JSON.stringify(canonicalizeSnapshot(payload));
  return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
};

export default {
  MQTT_TOPICS,
  SECURITY_STATUSES,
  OPERATIONAL_STATUSES,
  canonicalizeSnapshot,
  calculateCanonicalChecksum
};
