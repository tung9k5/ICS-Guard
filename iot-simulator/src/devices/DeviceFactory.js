import { PlcDevice } from './PlcDevice.js';
import { HmiDevice } from './HmiDevice.js';
import { SensorDevice } from './SensorDevice.js';
import { GatewayDevice } from './GatewayDevice.js';
import { BaseDevice } from './BaseDevice.js';

export class DeviceFactory {
  static createDevice(type, id, name, zone) {
    switch(type) {
      case 'PLC':
        return new PlcDevice(id, name, zone);
      case 'HMI':
        return new HmiDevice(id, name, zone);
      case 'SENSOR':
        return new SensorDevice(id, name, zone);
      case 'GATEWAY':
        return new GatewayDevice(id, name, zone);
      default:
        return new BaseDevice(id, name, zone, type || 'IoT Device');
    }
  }
}
