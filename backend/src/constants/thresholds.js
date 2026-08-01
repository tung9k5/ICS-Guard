// Anomaly detection thresholds
export const THRESHOLDS = Object.freeze({
  TRAFFIC_SPIKE_BPS: 50000,      // bytes/s — above this triggers DDoS alert
  CRITICAL_TEMPERATURE_C: 85.0,  // °C — above this triggers overheat alert
  FIRE_SMOKE_LEVEL: 400,         // above this triggers fire alert
  FLOOD_WATER_LEVEL: 70,         // above this triggers flood alert
});

// MQTT topic patterns
export const MQTT_TOPICS = Object.freeze({
  TELEMETRY_WILDCARD: 'ics/telemetry/#',
  TELEMETRY_PREFIX: 'ics/telemetry',
  CONTROL_PREFIX: 'ics/control',
});

// Bcrypt config
export const BCRYPT_SALT_ROUNDS = 10;
