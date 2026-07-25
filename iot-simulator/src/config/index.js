import dotenv from 'dotenv';

dotenv.config();

export const config = {
  mqtt: {
    url: process.env.MQTT_URL,
    tlsPort: process.env.MQTT_TLS_PORT,
    clientId: `iot-simulator-${Math.random().toString(16).substr(2, 8)}`,
    controlTopic: process.env.MQTT_CONTROL_TOPIC,
    telemetryTopicPrefix: process.env.MQTT_TELEMETRY_TOPIC_PREFIX,
  },
  aes: {
    secretKey: process.env.AES_SECRET_KEY,
  },
  simulator: {
    intervalMs: parseInt(process.env.SIMULATOR_INTERVAL_MS) || 5000,
    deviceCount: parseInt(process.env.SIMULATOR_DEVICE_COUNT) || 10,
    startupTimeoutMs: parseInt(process.env.SIMULATOR_STARTUP_TIMEOUT_MS) || 2000,
  }
};
