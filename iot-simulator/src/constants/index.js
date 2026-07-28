export const DEVICE_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  OFFLINE: 'OFFLINE',
  ISOLATED: 'ISOLATED'
});

export const SCENARIOS = Object.freeze({
  NORMAL: 'NORMAL',
  FIRE: 'FIRE',
  FLOOD: 'FLOOD',
  TRAFFIC_SPIKE: 'TRAFFIC_SPIKE',
  OVERHEAT: 'OVERHEAT',
  OFFLINE: 'OFFLINE'
});

export const SENSOR_TYPES = Object.freeze({
  TEMPERATURE: 'TEMPERATURE',
  HUMIDITY: 'HUMIDITY',
  SMOKE: 'SMOKE',
  GAS: 'GAS',
  WATER_LEVEL: 'WATER_LEVEL',
  VOLTAGE: 'VOLTAGE',
  CURRENT: 'CURRENT'
});

// Network traffic simulation constants (bytes/second)
export const TRAFFIC = Object.freeze({
  BASE: 1500,
  VARIANCE: 500,
  SPIKE_BASE: 60000,   // Must exceed backend THRESHOLDS.TRAFFIC_SPIKE_BPS (50000) to trigger alert
  SPIKE_VARIANCE: 5000,
});

// Battery drain per publish cycle
export const BATTERY_DRAIN_RATE = 0.01;
