export const INCIDENT_STATUSES = {
  OPEN: 'open',
  INVESTIGATING: 'investigating',
  INVESTIGATED: 'investigated',
  REMEDIATED: 'remediated',
  CLOSED: 'closed'
};

export const SEVERITY_LEVELS = {
  INFO: 'INFO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const DEVICE_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ISOLATED: 'isolated',
  ONLINE: 'online',
  OFFLINE: 'offline',
  QUARANTINED: 'quarantined'
};

export const DEVICE_TYPES = {
  GATEWAY: 'gateway',
  CONTROLLER: 'controller',
  CHIP: 'chip',
  SENSOR: 'sensor',
  ACTUATOR: 'actuator',
  IOT_DEVICE: 'IoT Device'
};

export const INCIDENT_TIMELINE_TYPES = {
  INCIDENT_CREATED: 'incident_created',
  AUTO_RESPONSE: 'auto_response',
  AI_ANALYSIS: 'ai_analysis',
  STATUS_CHANGE: 'status_change',
  MANUAL_NOTE: 'manual_note'
};

export const ALERT_STATUSES = {
  NEW: 'new',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  FALSE_POSITIVE: 'false_positive'
};

export const AUDIT_STATUSES = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

export const ATTACK_TYPES = {
  STOP: 'stop',
  TRAFFIC_SPIKE: 'traffic_spike',
  OVERHEAT: 'overheat',
  ROLLBACK: 'rollback'
};

export const AUDIT_ACTIONS = {
  ALERT_STATUS_UPDATED: 'ALERT_STATUS_UPDATED',
  DEVICE_UNISOLATION_TRIGGERED: 'DEVICE_UNISOLATION_TRIGGERED',
  DEVICE_ROLLBACK_TRIGGERED: 'DEVICE_ROLLBACK_TRIGGERED'
};
