import { v4 as uuidv4 } from 'uuid';
import { DEVICE_STATUSES, SCENARIOS, TRAFFIC, BATTERY_DRAIN_RATE } from '../constants/index.js';

export class BaseDevice {
  constructor(id, name, zone, type = 'IoT Device') {
    this.id = id || `sim-dev-${uuidv4().substring(0, 8)}`;
    this.name = name || `Simulated ${type} ${this.id}`;
    this.zone = zone || 'Zone-Sim';
    this.type = type;
    this.status = DEVICE_STATUSES.ACTIVE;
    this.scenario = SCENARIOS.NORMAL;
    
    this.sensors = [];
    this.battery = 100;
    this.networkTraffic = TRAFFIC.BASE; // bytes per second
  }

  setScenario(scenario) {
    this.scenario = scenario;
    if (scenario === SCENARIOS.TRAFFIC_SPIKE) {
      this.networkTraffic = TRAFFIC.SPIKE_BASE; // Above 50000 threshold — triggers alert
    } else {
      this.networkTraffic = TRAFFIC.BASE + Math.random() * TRAFFIC.VARIANCE;
    }
  }

  // To be overridden or extended by subclasses
  generateSpecificMetrics(metrics) {
    return metrics;
  }

  generatePayload() {
    if (this.status === DEVICE_STATUSES.OFFLINE || this.scenario === SCENARIOS.OFFLINE) {
      return null;
    }
    
    let metrics = {};
    for (const sensor of this.sensors) {
      metrics[sensor.type.toLowerCase()] = sensor.generate(this.scenario);
    }
    
    // Simulate battery drain
    this.battery = Math.max(0, this.battery - BATTERY_DRAIN_RATE);
    metrics.battery = parseFloat(this.battery.toFixed(1));
    
    // Simulate network traffic
    if (this.scenario === SCENARIOS.TRAFFIC_SPIKE) {
      metrics.bytes_per_second = this.networkTraffic + Math.random() * TRAFFIC.SPIKE_VARIANCE;
    } else {
      metrics.bytes_per_second = TRAFFIC.BASE + Math.random() * TRAFFIC.VARIANCE;
    }

    // Explicitly inject extreme metrics for scenarios to guarantee backend alert triggers
    // even if the device doesn't officially have these sensors.
    if (this.scenario === SCENARIOS.OVERHEAT) {
      metrics.temperature = 95.0 + Math.random() * 5; // > 85.0
    }
    if (this.scenario === SCENARIOS.FIRE) {
      metrics.smoke = 600 + Math.random() * 100; // > 400
      metrics.temperature = 90.0 + Math.random() * 10;
    }
    if (this.scenario === SCENARIOS.FLOOD) {
      metrics.water_level = 90 + Math.random() * 10; // > 70
    }

    // Call subclass specific metrics
    metrics = this.generateSpecificMetrics(metrics);

    return {
      device_id: this.id,
      device_type: this.type,
      zone: this.zone,
      metrics
    };
  }
}
