import { BaseDevice } from './BaseDevice.js';
import { Sensor } from '../sensors/Sensor.js';
import { SENSOR_TYPES } from '../constants/index.js';

export class PlcDevice extends BaseDevice {
  constructor(id, name, zone) {
    super(id, name, zone, 'PLC');
    this.sensors = [
      new Sensor(`temp-${this.id}`, SENSOR_TYPES.TEMPERATURE, { min: -20, max: 120, normalMin: 30, normalMax: 45, variance: 2 })
    ];
    this.motorRpm = 1500;
    this.cycleTime = 10; // ms
  }

  generateSpecificMetrics(metrics) {
    if (this.scenario === 'OVERHEAT') {
      this.motorRpm = 3000 + Math.random() * 500;
      this.cycleTime = 25 + Math.random() * 5;
    } else {
      this.motorRpm = 1500 + Math.random() * 100 - 50;
      this.cycleTime = 10 + Math.random() * 2 - 1;
    }
    
    metrics.motor_rpm = parseFloat(this.motorRpm.toFixed(1));
    metrics.plc_cycle_time = parseFloat(this.cycleTime.toFixed(1));
    return metrics;
  }
}
