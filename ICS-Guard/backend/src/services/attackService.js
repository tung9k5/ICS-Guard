import deviceRepository from '../repositories/deviceRepository.js';
import { publishMqtt } from './mqttService.js';
import AppError from '../utils/AppError.js';

class AttackService {
  async launch(deviceId, attackType) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError('Device not found', 404);

    if (device.status === 'isolated') {
      throw new AppError('Cannot launch attack on an isolated device.', 400);
    }

    try {
      publishMqtt('ics/control/attack', { device_id: deviceId, attack_type: attackType });
      return { message: `Attack ${attackType} sent to ${device.name}` };
    } catch (err) {
      throw new AppError('Failed to publish attack command via MQTT', 500);
    }
  }

  async getDevices(queryParams) {
    const { search, status, type, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (type) query.type = type;
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ name: searchRegex }, { ipAddress: searchRegex }];
    }
    if (status) query.status = status;

    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await deviceRepository.countAll(query);
    const devices = await deviceRepository.findAll(query, sortOption, skip, limitNumber);

    return { devices, total, pageNumber, limitNumber };
  }

  async removeDevice(id) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    await deviceRepository.deleteById(id);
  }

  async removeDevices(ids) {
    return deviceRepository.deleteMany(ids);
  }
}

export default new AttackService();
