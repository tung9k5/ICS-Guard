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
    const hasWanDos = this.activeAttacks.includes('WAN_DOS') || this.activeAttacks.includes('TRAFFIC_SPIKE');
    const hasRoutePoisoning = this.activeAttacks.includes('ROUTE_POISONING');

    if (hasWanDos) {
      metrics.bytes_per_second = 85000 + Math.random() * 5000; // > 80,000 Bps
      metrics.connected_devices = this.connectedDevices;
      metrics.cpu_usage = parseFloat((95 + Math.random() * 4.9).toFixed(1)); // 95-100%
      metrics.memory_usage = parseFloat((92 + Math.random() * 5).toFixed(1)); // 92-97%
    } else if (hasRoutePoisoning) {
      metrics.bytes_per_second = 200 + Math.random() * 100; // minimal traffic
      metrics.connected_devices = 0; // isolated from clients
      metrics.cpu_usage = parseFloat((CPU_BASE + Math.random() * CPU_VARIANCE).toFixed(1));
      metrics.memory_usage = parseFloat((MEMORY_BASE + Math.random() * MEMORY_VARIANCE).toFixed(1));
    } else {
      // Gateway has higher base traffic
      metrics.bytes_per_second = GATEWAY_TRAFFIC_BASE + Math.random() * GATEWAY_TRAFFIC_VARIANCE;
      
      // Randomize connected devices slightly
      if (Math.random() > 0.8) {
        this.connectedDevices = GATEWAY_BASE_DEVICES + Math.floor(Math.random() * GATEWAY_DEVICE_VARIANCE) - 2;
      }
      metrics.connected_devices = this.connectedDevices;
      metrics.cpu_usage = parseFloat((CPU_BASE + Math.random() * CPU_VARIANCE).toFixed(1)); // 15-25%
      metrics.memory_usage = parseFloat((MEMORY_BASE + Math.random() * MEMORY_VARIANCE).toFixed(1)); // 40-45%
    }
    
    return metrics;
  }
}

