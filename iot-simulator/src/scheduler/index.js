import fs from 'fs';
import path from 'path';
import { DeviceFactory } from '../devices/DeviceFactory.js';
import { publishTelemetry, getClient } from '../mqtt/index.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';
import { decryptPayload } from '../utils/crypto.js';

const STATE_FILE = path.join(process.cwd(), 'simulator_state.json');

class SimulatorManager {
  constructor() {
    this.devices = new Map();
    this.intervalId = null;
    this.zones = ['Zone-A', 'Zone-B'];
    this.connections = []; // Array of { from, to } network wires
  }

  saveState() {
    try {
      const state = {
        zones: this.zones,
        connections: this.connections,
        devices: Array.from(this.devices.entries()).map(([id, d]) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          zone: d.zone,
          isPowerConnected: d.isPowerConnected,
          approvalStatus: d.approvalStatus,
          ipAddress: d.ipAddress,
          macAddress: d.macAddress,
          intervalMs: d.intervalMs,
          x: d.x,
          y: d.y
        }))
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
      logger.error(`Error saving simulator state: ${e.message}`);
    }
  }

  loadState() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf8');
        const state = JSON.parse(raw);
        if (state.zones) this.zones = state.zones;
        if (state.connections) this.connections = state.connections;
        if (state.devices) {
          this.devices.clear();
          state.devices.forEach(d => {
            const dev = DeviceFactory.createDevice(d.type, d.id, d.name, d.zone);
            dev.isPowerConnected = d.isPowerConnected !== undefined ? d.isPowerConnected : true;
            dev.approvalStatus = d.approvalStatus || 'APPROVED';
            dev.ipAddress = d.ipAddress || dev.ipAddress;
            dev.macAddress = d.macAddress || dev.macAddress;
            dev.intervalMs = d.intervalMs || dev.intervalMs;
            dev.x = d.x !== undefined ? d.x : 0;
            dev.y = d.y !== undefined ? d.y : 0;
            this.devices.set(d.id, dev);
          });
        }
        logger.info(`Simulator state loaded successfully from ${STATE_FILE}.`);
        this.recalculateNetworkConnections();
        return true;
      }
    } catch (e) {
      logger.error(`Error loading simulator state: ${e.message}`);
    }
    return false;
  }

  init() {
    const loaded = this.loadState();
    if (!loaded) {
      logger.info(`Initializing simulator and pre-populating default devices...`);
      const defaultDevices = [
        { id: 'gateway-01', type: 'GATEWAY', name: 'Zone-A Gateway Router', zone: 'Zone-A' },
        { id: 'plc-01', type: 'PLC', name: 'PLC Factory 01', zone: 'Zone-A' },
        { id: 'sensor-01', type: 'SENSOR', name: 'Ambient Temp Sensor 01', zone: 'Zone-A' },
        { id: 'sensor-02', type: 'SENSOR', name: 'Storage Humidity Sensor 02', zone: 'Zone-B' },
        { id: 'hmi-01', type: 'HMI', name: 'Main HMI Control Panel', zone: 'Zone-B' }
      ];

      for (const d of defaultDevices) {
        if (!this.devices.has(d.id)) {
          const newDevice = DeviceFactory.createDevice(d.type, d.id, d.name, d.zone);
          newDevice.approvalStatus = 'APPROVED';
          this.devices.set(d.id, newDevice);
        }
      }

      this.connections = [
        { from: 'plc-01', to: 'gateway-01' },
        { from: 'sensor-01', to: 'gateway-01' },
        { from: 'sensor-02', to: 'gateway-01' },
        { from: 'hmi-01', to: 'gateway-01' }
      ];

      this.recalculateNetworkConnections();
      this.saveState();
    }
  }

  start() {
    if (this.intervalId) return;
    logger.info(`Starting simulation loop with interval ${config.simulator.intervalMs}ms`);
    
    this.intervalId = setInterval(() => {
      this.devices.forEach((device) => {
        const payload = device.generatePayload();
        if (payload && device.isPowerConnected && device.isNetworkConnected && device.approvalStatus === 'APPROVED') {
          publishTelemetry(device.id, payload);
        }
      });
    }, config.simulator.intervalMs);

    const mqttClient = getClient();
    if (mqttClient) {
      mqttClient.on('message', (topic, message) => {
        logger.info(`[DEBUG] scheduler received message on ${topic}`);
        if (topic.startsWith(`${config.mqtt.controlTopic}/`)) {
          try {
            const data = decryptPayload(message.toString());
            logger.info(`[DEBUG] decrypted data: ${JSON.stringify(data)}`);
            const deviceId = data.device_id;
            if (!deviceId) return;

            if (!this.devices.has(deviceId)) {
              logger.info(`Device ${deviceId} not found in simulator. Creating dynamically...`);
              const deviceType = data.device_type || 'SENSOR';
              const newDevice = DeviceFactory.createDevice(deviceType.toUpperCase(), deviceId, `Dynamic ${deviceType} ${deviceId}`, 'Zone-Dynamic');
              newDevice.approvalStatus = 'APPROVED';
              this.devices.set(deviceId, newDevice);
              
              const gateway = this.getAllDevices().find(gw => gw.type === 'GATEWAY');
              if (gateway) {
                this.addConnection(deviceId, gateway.id);
              }
            }

            const device = this.devices.get(deviceId);
            const attackType = data.attack_type;

            if (attackType === 'STOP') {
              device.clearAllAttacks();
              device.isNetworkConnected = false;
              device.status = 'ISOLATED';
              device.addLog('CRITICAL', 'ALERT: Device network interface isolated by remote security command.');
              this.saveState();
            } else if (attackType === 'ROLLBACK') {
              device.clearAllAttacks();
              device.status = 'ACTIVE';
              device.addLog('INFO', 'RECOVERY: Device firmware and logic rolled back to safe state.');
              this.recalculateNetworkConnections();
              this.saveState();
            } else if (attackType) {
              let attack = attackType.toUpperCase();
              if (attack === 'DDOS') attack = 'TRAFFIC_SPIKE';
              device.triggerAttack(attack);
              this.saveState();
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

  getAllDevices() {
    return Array.from(this.devices.values());
  }

  addDevice(type, id, name, zone, x = 0, y = 0) {
    if (this.devices.has(id)) {
      return false;
    }
    const newDevice = DeviceFactory.createDevice(type.toUpperCase(), id, name, zone);
    newDevice.x = x;
    newDevice.y = y;
    this.devices.set(id, newDevice);
    logger.info(`Device ${id} added manually via API.`);
    this.recalculateNetworkConnections();
    this.saveState();
    return newDevice;
  }

  removeDevice(id) {
    if (this.devices.has(id)) {
      this.devices.delete(id);
      this.connections = this.connections.filter(c => c.from !== id && c.to !== id);
      logger.info(`Device ${id} removed manually via API.`);
      this.recalculateNetworkConnections();
      this.saveState();
      return true;
    }
    return false;
  }

  recalculateNetworkConnections() {
    const allDevices = this.getAllDevices();
    
    allDevices.forEach(d => {
      if (d.type === 'GATEWAY' && d.isPowerConnected) {
        d.isNetworkConnected = true;
      } else {
        d.isNetworkConnected = false;
      }
    });

    const queue = allDevices.filter(d => d.type === 'GATEWAY' && d.isPowerConnected);
    const visited = new Set(queue.map(d => d.id));

    while (queue.length > 0) {
      const current = queue.shift();

      this.connections.forEach(conn => {
        let neighborId = null;
        if (conn.from === current.id) neighborId = conn.to;
        else if (conn.to === current.id) neighborId = conn.from;

        if (neighborId && !visited.has(neighborId)) {
          const neighbor = this.getDevice(neighborId);
          if (neighbor && neighbor.isPowerConnected) {
            neighbor.isNetworkConnected = true;
            visited.add(neighborId);
            queue.push(neighbor);
          }
        }
      });
    }
  }

  getZones() {
    return this.zones;
  }

  addZone(name) {
    if (!this.zones.includes(name)) {
      this.zones.push(name);
      this.saveState();
      return true;
    }
    return false;
  }

  removeZone(name) {
    this.zones = this.zones.filter(z => z !== name);
    this.devices.forEach(d => {
      if (d.zone === name) d.zone = 'Unassigned';
    });
    this.saveState();
  }

  getConnections() {
    return this.connections;
  }

  addConnection(from, to) {
    const exists = this.connections.some(c => (c.from === from && c.to === to) || (c.from === to && c.to === from));
    if (!exists && from !== to) {
      this.connections.push({ from, to });
      this.recalculateNetworkConnections();
      
      const devFrom = this.getDevice(from);
      const devTo = this.getDevice(to);
      if (devFrom) devFrom.addLog('INFO', `PHYSICAL_ACTION: Connected network wire to ${to}.`);
      if (devTo) devTo.addLog('INFO', `PHYSICAL_ACTION: Connected network wire to ${from}.`);
      
      this.saveState();
      return true;
    }
    return false;
  }

  removeConnection(from, to) {
    const initialLen = this.connections.length;
    this.connections = this.connections.filter(c => !((c.from === from && c.to === to) || (c.from === to && c.to === from)));
    if (this.connections.length < initialLen) {
      this.recalculateNetworkConnections();
      
      const devFrom = this.getDevice(from);
      const devTo = this.getDevice(to);
      if (devFrom) devFrom.addLog('INFO', `PHYSICAL_ACTION: Disconnected network wire from ${to}.`);
      if (devTo) devTo.addLog('INFO', `PHYSICAL_ACTION: Disconnected network wire from ${from}.`);
      
      this.saveState();
      return true;
    }
    return false;
  }
}

export const simulatorManager = new SimulatorManager();
