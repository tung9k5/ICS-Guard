import { Device, AuditLog } from '../models/index.js';
import { isolateDevice } from '../services/securityService.js';
import { sendEmailAlert } from '../services/emailService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { publishMqtt } from '../services/mqttService.js';
<<<<<<< HEAD
import { validateDevice } from '../../../shared/schemas/deviceSchema.js';
=======
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
>>>>>>> origin/main

const injectVulnerabilityInfo = (deviceDoc) => {
  const device = deviceDoc.toObject ? deviceDoc.toObject() : deviceDoc;
  const nodeType = device.node_type || device.nodeType || 'sensor';
  
  // Gán thông tin phiên bản firmware theo loại thiết bị
  device.firmware_version = nodeType === 'gateway' ? 'v1.4.2-stable' :
                            nodeType === 'controller' ? 'v2.1.0-lts' :
                            'v1.0.5-patch3';
                            
  // Ánh xạ lỗi bảo mật CVE thực tế (Asset & CVE Correlation)
  if (nodeType === 'gateway') {
    device.cves = [
      { cve: 'CVE-2023-31813', severity: 'HIGH', score: 8.8, desc: 'Lỗ hổng tràn bộ đệm TLS trên gateway' }
    ];
  } else if (nodeType === 'controller') {
    device.cves = [
      { cve: 'CVE-2022-31800', severity: 'CRITICAL', score: 9.8, desc: 'Lập trình logic OB1 không xác thực chữ ký' }
    ];
  } else {
    device.cves = [
      { cve: 'CVE-2024-1020', severity: 'MEDIUM', score: 5.3, desc: 'Kênh ADC dễ bị can thiệp tín hiệu điện áp' }
    ];
  }
  
  return device;
};

export const getAllDevices = async (req, res) => {
  try {
    const { search, status, type, order, page = 1, per_page = 10 } = req.query;

    // Xây dựng query filter
    let query = {};
    
    // Ràng buộc bảo mật: User nào chỉ được thấy device của user đó
    if (req.user && req.user.id) {
      query.userId = req.user.id;
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

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    // Thiết lập sorting
    let sortOption = {};
    if (order === 'asc') {
      sortOption = { createdAt: 1 };
    } else {
      sortOption = { createdAt: -1 }; // Mặc định desc (mới nhất)
    }

    // Xử lý phân trang
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Truy vấn CSDL
    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .select('_id name type zone ipAddress ip_address macAddress mac_address description status createdAt updatedAt')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/devices'}`;
    const paginated = formatPagination(devices, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách thiết bị thành công');
  } catch (error) {
    console.error('GetAllDevices error:', error);
    return errorResponse(res, 'Failed to retrieve devices', error.message);
  }
};

export const getDeviceById = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id).select('_id name type zone ipAddress ip_address macAddress mac_address description status createdAt updatedAt');
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }
    return successResponse(res, device, 'Lấy thông tin thiết bị thành công');
  } catch (error) {
    console.error('GetDeviceById error:', error);
    return errorResponse(res, 'Failed to retrieve device', error.message);
  }
};

export const createDevice = async (req, res) => {
  const { name, type, ipAddress, ip_address, macAddress, description, status } = req.body;

  const actualIp = ipAddress || ip_address;
  
  if (!name || !actualIp) {
    return errorResponse(res, 'Name and ip_address are required', null, 400);
  }

  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (actualIp && !ipRegex.test(actualIp.trim())) {
    return errorResponse(res, 'Invalid IP Address format', null, 400);
  }

  const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
  if (macAddress && !macRegex.test(macAddress.trim())) {
    return errorResponse(res, 'Invalid MAC Address format', null, 400);
  }

<<<<<<< HEAD
  const customId = req.body._id || req.body.id || macAddress.replace(/:/g, '').toLowerCase();
  
  // Use shared validation layer
  const validationResult = validateDevice({
    _id: customId,
    name,
    type,
    ipAddress,
    macAddress,
    node_type: req.body.node_type,
    status: req.body.status
  });
=======
  try {
    const defaultMac = macAddress || `00:00:00:${Math.floor(Math.random()*100)}:${Math.floor(Math.random()*100)}:${Math.floor(Math.random()*100)}`;
    let customId = req.body._id || req.body.id;
    if (!customId) {
      const lastDevice = await Device.findOne({ _id: /^D-\d{3,}$/ }).sort({ _id: -1 });
      if (lastDevice && lastDevice._id) {
        const lastNumber = parseInt(lastDevice._id.split('-')[1], 10);
        const nextNumber = lastNumber + 1;
        customId = `D-${nextNumber.toString().padStart(3, '0')}`;
      } else {
        customId = 'D-001';
      }
    }
>>>>>>> origin/main

  if (!validationResult.isValid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Validation failed.', details: validationResult.errors });
  }

  try {
    const newDevice = await Device.create({
      _id: customId,
      userId: req.user ? req.user.id : null,
      name,
      type: type || 'IoT Device',
      ipAddress: actualIp,
      macAddress: defaultMac,
      description: description || '',
      status: status || 'active',
      lastSeen: new Date(),
    });

    const cleanDevice = {
      _id: newDevice._id,
      name: newDevice.name,
      type: newDevice.type,
      ip_address: newDevice.ipAddress,
      mac_address: newDevice.macAddress,
      description: newDevice.description,
      status: newDevice.status,
      createdAt: newDevice.createdAt,
      updatedAt: newDevice.updatedAt
    };

    return successResponse(res, cleanDevice, 'Thêm thiết bị mới thành công', 201);
  } catch (error) {
    console.error('CreateDevice error:', error);
    return errorResponse(res, 'Failed to create device', error.message);
  }
};

export const updateDevice = async (req, res) => {
  const { id } = req.params;
  const { name, type, ipAddress, ip_address, macAddress, description, status } = req.body;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }

    if (name !== undefined) device.name = name;
    if (type !== undefined) device.type = type;
    if (description !== undefined) device.description = description;
    
    const actualIp = ipAddress || ip_address;
    const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    
    if (actualIp !== undefined) {
      if (!ipRegex.test(actualIp.trim())) {
        return errorResponse(res, 'Invalid IP Address format', null, 400);
      }
      device.ipAddress = actualIp.trim();
      device.ip_address = actualIp.trim();
    }
    
    if (macAddress !== undefined) {
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(macAddress.trim())) {
        return errorResponse(res, 'Invalid MAC Address format', null, 400);
      }
      device.macAddress = macAddress.trim();
      device.mac_address = macAddress.trim();
    }
    
    if (status !== undefined) {
      const validStatuses = ['active', 'inactive', 'isolated', 'online', 'offline', 'quarantined'];
      if (!validStatuses.includes(status)) {
        return errorResponse(res, `Status must be one of: ${validStatuses.join(', ')}`, null, 400);
      }
      device.status = status;
    }

    await device.save();
    
    const cleanDevice = {
      _id: device._id,
      name: device.name,
      type: device.type,
      ip_address: device.ipAddress,
      mac_address: device.macAddress,
      description: device.description,
      status: device.status,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt
    };

    if (typeof socketService !== 'undefined') {
      socketService.emitDeviceStatusChanged(device);
    }
    return successResponse(res, cleanDevice, 'Cập nhật thiết bị thành công');
  } catch (error) {
    console.error('UpdateDevice error:', error);
    return errorResponse(res, 'Failed to update device', error.message);
  }
};

export const deleteDevice = async (req, res) => {
  const { id } = req.params;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }

    await device.deleteOne();
    return successResponse(res, null, 'Xóa thiết bị thành công');
  } catch (error) {
    console.error('DeleteDevice error:', error);
    return errorResponse(res, 'Failed to delete device', error.message);
  }
};

export const isolateDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  const rawIp = req.ip || req.connection.remoteAddress;
  const ipAddress = rawIp.replace(/^::ffff:/, '');

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    if (device.status === 'isolated') {
      return res.status(400).json({ message: 'Device is already isolated.' });
    }

    // Call security isolation service
    const actor = req.user ? req.user.username : 'API Request';
    await isolateDevice(device, actor, ipAddress);

    return res.status(200).json({ message: `Device "${device.name}" has been successfully isolated.`, device });
  } catch (error) {
    console.error('IsolateDevice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to isolate device.' });
  }
};

export const unisolateDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  const rawIp = req.ip || req.connection.remoteAddress;
  const ipAddress = rawIp.replace(/^::ffff:/, '');

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    if (device.status === 'active' || device.status === 'online') {
      return res.status(400).json({ message: 'Device is already active.' });
    }

    device.status = 'active';
    await device.save();
    socketService.emitDeviceStatusChanged(device);

    const actor = req.user ? req.user.username : 'API Request';

    // Audit Log
    await AuditLog.create({
      action: `DEVICE_UNISOLATION_TRIGGERED`,
      username: actor,
      ipAddress,
      details: { deviceId: device._id, name: device.name, ipAddress: device.ipAddress },
      status: 'SUCCESS',
    });

    // Alert
    const subject = `DEVICE RECONNECTED: ${device.name}`;
    const text = `Security Notice: Device "${device.name}" (IP: ${device.ipAddress}) has been reconnected (un-isolated) by ${actor}.`;
    
    await sendEmailAlert({
      subject,
      text,
      html: `<p>Security Notice: Device <strong>${device.name}</strong> (IP: <code>${device.ipAddress}</code>) has been reconnected to the network by <strong>${actor}</strong>.</p>`,
    });

    await sendTelegramAlert(
      `🔔 *DEVICE RECONNECTED*\n\nDevice *${device.name}* (IP: ${device.ipAddress}) has been reconnected to the network.\nOperator: ${actor}`
    );

    return res.status(200).json({ message: `Device "${device.name}" has been successfully reconnected.`, device });
  } catch (error) {
    console.error('UnisolateDevice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reconnect device.' });
  }
};

export const rollbackDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    // Set status to active (recovering logic)
    device.status = 'active';
    await device.save();

    // Trigger MQTT rollback command to PLC simulator
    publishMqtt('ics/control/attack', { device_id: id, attack_type: 'rollback' });

    const actor = req.user ? req.user.username : 'API Request';

    // Audit Log
    await AuditLog.create({
      action: `DEVICE_ROLLBACK_TRIGGERED`,
      username: actor,
      ipAddress,
      details: { deviceId: device._id, name: device.name, ipAddress: device.ipAddress },
      status: 'SUCCESS',
    });

    // Alert
    const subject = `DEVICE LOGIC ROLLBACK: ${device.name}`;
    const text = `Security Notice: PLC device "${device.name}" logic has been rolled back to a clean safe state by ${actor}.`;
    
    await sendEmailAlert({
      subject,
      text,
      html: `<p>Security Notice: PLC device <strong>${device.name}</strong> logic has been rolled back to a clean safe state by <strong>${actor}</strong>.</p>`,
    });

    await sendTelegramAlert(
      `🔄 *PLC LOGIC ROLLBACK*\n\nDevice *${device.name}* logic has been rolled back to a safe-mode clean logic.\nOperator: ${actor}`
    );

    return res.status(200).json({ message: `Lệnh khôi phục logic an toàn đã được gửi đến PLC "${device.name}".`, device });
  } catch (error) {
    console.error('RollbackDevice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to rollback device.' });
  }
};

export default {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
  rollbackDeviceEndpoint,
};
