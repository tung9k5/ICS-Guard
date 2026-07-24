import deviceRepository from '../repositories/deviceRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import { isolateDevice } from './securityService.js';
import { sendEmailAlert } from './emailService.js';
import { sendTelegramAlert } from './telegramService.js';
import { publishMqtt } from './mqttService.js';
import { validateDevice } from '../shared/schemas/deviceSchema.js';
import { ROLES, DEVICE_STATUSES, ATTACK_TYPES, AUDIT_STATUSES, AUDIT_ACTIONS, DEVICE_TYPES } from '../constants/index.js';
import AppError from '../utils/AppError.js';
import socketService from './socketService.js';
import { parsePagination, buildSortOption } from '../utils/pagination.js';

class DeviceService {
  async getAll(queryParams, user) {
    const { search, status, type, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (user && user.id) {
      if (user.role?.toLowerCase() !== ROLES.ADMIN) {
        query.userId = user.id;
      }
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { type: searchRegex },
        { ipAddress: searchRegex },
        { ip_address: searchRegex }
      ];
    }
    if (status) query.status = status;
    if (type) query.type = type;

    const sortOption = buildSortOption(order);
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    const total = await deviceRepository.countAll(query);
    const devices = await deviceRepository.findAll(
      query,
      sortOption,
      skip,
      limitNumber,
      '_id name type zone ipAddress ip_address macAddress mac_address description status location manufacturer serial_number uptime battery_level tags configuration createdAt updatedAt'
    );

    return { devices, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const device = await deviceRepository.findById(id, '_id name type zone ipAddress ip_address macAddress mac_address description status location manufacturer serial_number uptime battery_level tags configuration createdAt updatedAt');
    if (!device) throw new AppError('Device not found', 404);
    return device;
  }

  async create(data, user) {
    const { name, type, ipAddress, ip_address, macAddress, description, status, node_type, _id, id, location, manufacturer, serial_number, uptime, battery_level, tags, configuration } = data;
    const actualIp = ipAddress || ip_address;
    const defaultMac = macAddress || `00:00:00:${Math.floor(Math.random() * 100)}:${Math.floor(Math.random() * 100)}:${Math.floor(Math.random() * 100)}`;

    let customId = _id || id;
    if (!customId) {
      if (macAddress) {
        customId = macAddress.replace(/:/g, '').toLowerCase();
      } else {
        try {
          const lastDevice = await deviceRepository.findLastByPattern(/^D-\d{3,}$/);
          if (lastDevice && lastDevice._id) {
            const lastNumber = parseInt(lastDevice._id.split('-')[1], 10);
            customId = `D-${(lastNumber + 1).toString().padStart(3, '0')}`;
          } else {
            customId = 'D-001';
          }
        } catch (err) {
          customId = `D-${Math.floor(Math.random() * 1000)}`;
        }
      }
    }

    const validationResult = validateDevice({
      _id: customId,
      name,
      type,
      ipAddress: actualIp,
      macAddress: defaultMac,
      node_type,
      status
    });

    if (!validationResult.isValid) {
      throw new AppError(`Validation failed: ${JSON.stringify(validationResult.errors)}`, 400);
    }

    const newDevice = await deviceRepository.create({
      _id: customId,
      userId: user ? user.id : null,
      name,
      type: type || DEVICE_TYPES.IOT_DEVICE,
      ipAddress: actualIp,
      macAddress: defaultMac,
      description: description || '',
      status: status || DEVICE_STATUSES.ACTIVE,
      node_type,
      location,
      manufacturer,
      serial_number,
      uptime,
      battery_level,
      tags: tags || [],
      configuration: configuration || {},
      lastSeen: new Date(),
    });

    return {
      _id: newDevice._id,
      name: newDevice.name,
      type: newDevice.type,
      ip_address: newDevice.ipAddress,
      mac_address: newDevice.macAddress,
      description: newDevice.description,
      status: newDevice.status,
      location: newDevice.location,
      manufacturer: newDevice.manufacturer,
      serial_number: newDevice.serial_number,
      uptime: newDevice.uptime,
      battery_level: newDevice.battery_level,
      tags: newDevice.tags,
      configuration: newDevice.configuration,
      createdAt: newDevice.createdAt,
      updatedAt: newDevice.updatedAt
    };
  }

  async update(id, data) {
    const { name, type, ipAddress, ip_address, macAddress, description, status, location, manufacturer, serial_number, uptime, battery_level, tags, configuration } = data;
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (manufacturer !== undefined) updateData.manufacturer = manufacturer;
    if (serial_number !== undefined) updateData.serial_number = serial_number;
    if (uptime !== undefined) updateData.uptime = uptime;
    if (battery_level !== undefined) updateData.battery_level = battery_level;
    if (tags !== undefined) updateData.tags = tags;
    if (configuration !== undefined) updateData.configuration = configuration;

    const actualIp = ipAddress || ip_address;
    if (actualIp !== undefined) {
      updateData.ipAddress = actualIp.trim();
      updateData.ip_address = actualIp.trim();
    }

    if (macAddress !== undefined) {
      updateData.macAddress = macAddress.trim();
      updateData.mac_address = macAddress.trim();
    }
    if (status !== undefined) updateData.status = status;

    const updatedDevice = await deviceRepository.updateById(id, updateData);

    const cleanDevice = {
      _id: updatedDevice._id,
      name: updatedDevice.name,
      type: updatedDevice.type,
      ip_address: updatedDevice.ipAddress,
      mac_address: updatedDevice.macAddress,
      description: updatedDevice.description,
      status: updatedDevice.status,
      createdAt: updatedDevice.createdAt,
      updatedAt: updatedDevice.updatedAt
    };

    if (typeof socketService !== 'undefined') {
      socketService.emitDeviceStatusChanged(updatedDevice);
    }
    return cleanDevice;
  }

  async remove(id) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    await deviceRepository.deleteById(id);
  }

  async removeMany(ids) {
    return deviceRepository.deleteMany(ids);
  }

  async isolate(id, actor, ipAddress) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    if (device.status === DEVICE_STATUSES.ISOLATED) throw new AppError('Device is already isolated', 400);

    await isolateDevice(device, actor, ipAddress);
    return device;
  }

  async unisolate(id, actor, ipAddress) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);
    if (device.status === DEVICE_STATUSES.ACTIVE || device.status === DEVICE_STATUSES.ONLINE) throw new AppError('Device is already active', 400);

    const updatedDevice = await deviceRepository.updateById(id, { status: DEVICE_STATUSES.ACTIVE });

    if (typeof socketService !== 'undefined') {
      socketService.emitDeviceStatusChanged(updatedDevice);
    }

    await auditRepository.create({
      action: AUDIT_ACTIONS.DEVICE_UNISOLATION_TRIGGERED,
      username: actor,
      ipAddress,
      details: { deviceId: updatedDevice._id, name: updatedDevice.name, ipAddress: updatedDevice.ipAddress },
      status: AUDIT_STATUSES.SUCCESS,
    });

    const subject = `DEVICE RECONNECTED: ${updatedDevice.name}`;
    const text = `Security Notice: Device "${updatedDevice.name}" (IP: ${updatedDevice.ipAddress}) has been reconnected (un-isolated) by ${actor}.`;

    await sendEmailAlert({
      subject,
      text,
      html: `<p>Security Notice: Device <strong>${updatedDevice.name}</strong> (IP: <code>${updatedDevice.ipAddress}</code>) has been reconnected to the network by <strong>${actor}</strong>.</p>`,
    });

    await sendTelegramAlert(
      `🔔 *DEVICE RECONNECTED*\n\nDevice *${updatedDevice.name}* (IP: ${updatedDevice.ipAddress}) has been reconnected to the network.\nOperator: ${actor}`
    );

    return updatedDevice;
  }

  async rollback(id, actor, ipAddress) {
    const device = await deviceRepository.findById(id);
    if (!device) throw new AppError('Device not found', 404);

    const updatedDevice = await deviceRepository.updateById(id, { status: DEVICE_STATUSES.ACTIVE });
    publishMqtt('ics/control/attack', { device_id: id, attack_type: ATTACK_TYPES.ROLLBACK });

    await auditRepository.create({
      action: AUDIT_ACTIONS.DEVICE_ROLLBACK_TRIGGERED,
      username: actor,
      ipAddress,
      details: { deviceId: updatedDevice._id, name: updatedDevice.name, ipAddress: updatedDevice.ipAddress },
      status: AUDIT_STATUSES.SUCCESS,
    });

    const subject = `DEVICE LOGIC ROLLBACK: ${updatedDevice.name}`;
    const text = `Security Notice: PLC device "${updatedDevice.name}" logic has been rolled back to a clean safe state by ${actor}.`;

    await sendEmailAlert({
      subject,
      text,
      html: `<p>Security Notice: PLC device <strong>${updatedDevice.name}</strong> logic has been rolled back to a clean safe state by <strong>${actor}</strong>.</p>`,
    });

    await sendTelegramAlert(
      `🔄 *PLC LOGIC ROLLBACK*\n\nDevice *${updatedDevice.name}* logic has been rolled back to a safe-mode clean logic.\nOperator: ${actor}`
    );

    return updatedDevice;
  }
}

export default new DeviceService();
