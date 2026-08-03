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
    const hasDataSpoofing = this.activeAttacks.includes('DATA_SPOOFING');
    const hasFirmwareAttack = this.activeAttacks.includes('FIRMWARE_ATTACK');

    if (hasDataSpoofing) {
      metrics.temperature = 95.5; // frozen at dangerous level
      metrics.humidity = 88.0;    // frozen at high level
      metrics.sensor_health = 10;
    } else if (hasFirmwareAttack) {
      metrics.sensor_health = 0; // failed firmware state
    } else {
      metrics.sensor_health = 100;
    }
    return metrics;
  }
}

