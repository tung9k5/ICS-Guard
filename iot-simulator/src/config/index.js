import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from current directory first, then fallback to root directory
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  mqtt: {
    url: process.env.MQTT_URL || 'mqtt://localhost:1883',
    tlsPort: process.env.MQTT_TLS_PORT,
    clientId: `iot-simulator-${Math.random().toString(16).substr(2, 8)}`,
    controlTopic: process.env.MQTT_CONTROL_TOPIC || 'ics/control',
    telemetryTopicPrefix: process.env.MQTT_TELEMETRY_TOPIC_PREFIX || 'ics/telemetry',
  },
  aes: {
    secretKey: process.env.AES_SECRET_KEY || 'default_secret_key_32_bytes_long_!',
  },
  simulator: {
    intervalMs: parseInt(process.env.SIMULATOR_INTERVAL_MS) || 5000,
    deviceCount: parseInt(process.env.SIMULATOR_DEVICE_COUNT) || 10,
    startupTimeoutMs: parseInt(process.env.SIMULATOR_STARTUP_TIMEOUT_MS) || 2000,
  }
};

