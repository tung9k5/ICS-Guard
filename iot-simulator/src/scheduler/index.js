import { DeviceFactory } from '../devices/DeviceFactory.js';
import { publishTelemetry, getClient } from '../mqtt/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { decryptPayload } from '../utils/crypto.js';

class SimulatorManager {
  constructor() {
    this.devices = new Map();
    this.intervalId = null;
  }

  init(deviceCount = config.simulator.deviceCount) {
    logger.info(`Initializing devices using Factory...`);
    
    const initialDevices = [
      DeviceFactory.createDevice('PLC', 'PLC-1', 'S7-1200 Water Pump', 'Zone-A'),
      DeviceFactory.createDevice('HMI', 'HMI-1', 'Main Control Panel', 'Zone-A'),
      DeviceFactory.createDevice('GATEWAY', 'GATEWAY-1', 'Edge Gateway 1', 'Zone-Core')
    ];

    const types = ['PLC', 'SENSOR', 'HMI', 'GATEWAY', 'ACTUATOR', 'CAMERA', 'CONTROLLER', 'OTHER'];
    const zones = ['Zone-A', 'Zone-B', 'Zone-C', 'Zone-D', 'Zone-E'];

    for (let i = initialDevices.length + 1; i <= deviceCount; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const zone = zones[Math.floor(Math.random() * zones.length)];
      const id = `${type}-${i}`;
      const name = `Simulated ${type} ${i}`;
      initialDevices.push(DeviceFactory.createDevice(type, id, name, zone));
    }

    for (const device of initialDevices) {
      this.devices.set(device.id, device);
    }
  }

  start() {
    if (this.intervalId) return;
    logger.info(`Starting simulation loop with interval ${config.simulator.intervalMs}ms`);
    
    this.intervalId = setInterval(() => {
      this.devices.forEach((device) => {
        const payload = device.generatePayload();
        if (payload) {
          publishTelemetry(device.id, payload);
        }
      });
    }, config.simulator.intervalMs);

    // Listen for control commands
    const mqttClient = getClient();
    if (mqttClient) {
      mqttClient.on('message', (topic, message) => {
        logger.info(`[DEBUG] scheduler received message on ${topic}`);
        if (topic.startsWith(`${config.mqtt.controlTopic}/`)) {
          logger.info(`[DEBUG] topic starts with controlTopic/`);
          try {
            const data = decryptPayload(message.toString());
            logger.info(`[DEBUG] decrypted data: ${JSON.stringify(data)}`);
            // Assume format: { device_id, attack_type } or { device_id, scenario }
            const deviceId = data.device_id;
            if (!this.devices.has(deviceId)) {
              logger.info(`Device ${deviceId} not found in simulator. Creating dynamically...`);
              const deviceType = data.device_type || 'SENSOR';
              const newDevice = DeviceFactory.createDevice(deviceType.toUpperCase(), deviceId, `Dynamic ${deviceType} ${deviceId}`, 'Zone-Dynamic');
              this.devices.set(deviceId, newDevice);
            }

            const device = this.devices.get(deviceId);
            if (data.scenario) {
              device.setScenario(data.scenario);
              logger.info(`Set scenario ${data.scenario} for ${deviceId}`);
            }
          } catch (e) {
            logger.error(`Error parsing control message: ${e.message}`);
          }
        }
      });
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('Simulation loop stopped.');
    }
  }

  getDevice(id) {
    return this.devices.get(id);
  }

  setDeviceScenario(id, scenario) {
    const device = this.devices.get(id);
    if (device) {
      device.setScenario(scenario);
      return true;
    }
    return false;
  }
}

export const simulatorManager = new SimulatorManager();
