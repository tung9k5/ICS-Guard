import { BaseDevice } from './BaseDevice.js';
import { Sensor } from '../sensors/Sensor.js';
import { SENSOR_TYPES } from '../constants/index.js';

export class SensorDevice extends BaseDevice {
  constructor(id, name, zone) {
    super(id, name, zone, 'SENSOR');
    this.sensors = [
      new Sensor(`temp-${this.id}`, SENSOR_TYPES.TEMPERATURE, { min: -20, max: 120, normalMin: 22, normalMax: 30, variance: 1 }),
      new Sensor(`hum-${this.id}`, SENSOR_TYPES.HUMIDITY, { min: 0, max: 100, normalMin: 45, normalMax: 60, variance: 2 }),
    ];
  }

  generateSpecificMetrics(metrics) {
    // Specific sensor metrics can be added here if needed
    metrics.sensor_health = 100;
    return metrics;
  }
}
