import { BaseDevice } from './BaseDevice.js';

const GATEWAY_TRAFFIC_BASE = 5000;
const GATEWAY_TRAFFIC_VARIANCE = 2000;
const GATEWAY_BASE_DEVICES = 10;
const GATEWAY_DEVICE_VARIANCE = 5;
const CPU_BASE = 15;
const CPU_VARIANCE = 10;
const MEMORY_BASE = 40;
const MEMORY_VARIANCE = 5;

export class GatewayDevice extends BaseDevice {
  constructor(id, name, zone) {
    super(id, name, zone, 'GATEWAY');
    this.connectedDevices = GATEWAY_BASE_DEVICES;
  }

  generateSpecificMetrics(metrics) {
    // Gateway has higher base traffic
    if (this.scenario !== 'TRAFFIC_SPIKE') {
      metrics.bytes_per_second = GATEWAY_TRAFFIC_BASE + Math.random() * GATEWAY_TRAFFIC_VARIANCE;
    }
    
    // Randomize connected devices slightly
    if (Math.random() > 0.8) {
      this.connectedDevices = GATEWAY_BASE_DEVICES + Math.floor(Math.random() * GATEWAY_DEVICE_VARIANCE) - 2;
    }

    metrics.connected_devices = this.connectedDevices;
    metrics.cpu_usage = parseFloat((CPU_BASE + Math.random() * CPU_VARIANCE).toFixed(1)); // 15-25%
    metrics.memory_usage = parseFloat((MEMORY_BASE + Math.random() * MEMORY_VARIANCE).toFixed(1)); // 40-45%
    
    return metrics;
  }
}
