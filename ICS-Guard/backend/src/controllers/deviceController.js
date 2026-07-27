import { Device, AuditLog } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import { isolateDevice } from '../services/securityService.js';
import { sendEmailAlert } from '../services/emailService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { publishMqtt } from '../services/mqttService.js';
import socketService from '../services/socketService.js';
import { validateDevice } from '../../../shared/schemas/deviceSchema.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAllDevices = async (req, res) => {
  try {
    const { search, status, type, order, page = 1, per_page = 10 } = req.query;

    // Xây dựng query filter
    let query = {};

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
      .select('_id name type node_type zone ipAddress ip_address macAddress mac_address parent_id hardware_model firmware_version icon_path description status lastSeen createdAt updatedAt')
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

// -------------------------------------------------------
// GET /public/list-all — Tr\u1ea3 th\u1eb3ng array (kh\u00f4ng ph\u00e2n trang)
// D\u00f9ng cho Python IoT Simulator, AI Engine, etc.
// -------------------------------------------------------
export const getAllDevicesRaw = async (req, res) => {
  try {
    const devices = await Device.find({})
      .select('_id name type node_type zone ipAddress ip_address macAddress mac_address parent_id hardware_model firmware_version icon_path description status lastSeen createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json(devices);
  } catch (error) {
    console.error('GetAllDevicesRaw error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
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
  const { name, type, ipAddress, ip_address, macAddress, description, status, zone, parent_id, node_type, icon_path, hardware_model, firmware_version } = req.body;

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

  const defaultMac = macAddress || `00:00:00:${Math.floor(Math.random() * 100)}:${Math.floor(Math.random() * 100)}:${Math.floor(Math.random() * 100)}`;
  let customId = req.body._id || req.body.id;
  if (!customId) {
    if (macAddress) {
      customId = macAddress.replace(/:/g, '').toLowerCase();
    } else {
      // Use UUIDv4 to prevent race conditions during concurrent device creations
      customId = `D-${uuidv4().substring(0, 8)}`;
    }
  }

  // Use shared validation layer
  const validationResult = validateDevice({
    _id: customId,
    name,
    type: type || 'IoT Device',
    ipAddress: actualIp,
    macAddress: defaultMac,
    node_type: node_type || type || 'sensor',
    status: status || 'active'
  });

  if (!validationResult.isValid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Validation failed.', details: validationResult.errors });
  }

  try {
    const newDevice = await Device.create({
      _id: customId,
      userId: req.user ? req.user.id : null,
      name,
      type: type || 'IoT Device',
      node_type: node_type || type || 'sensor',
      zone: zone || 'Zone-A',
      ipAddress: actualIp,
      macAddress: defaultMac,
      parent_id: parent_id || null,
      icon_path: icon_path || 'Cpu',
      hardware_model: hardware_model || '',
      firmware_version: firmware_version || '',
      description: description || '',
      status: status || 'active',
      lastSeen: new Date(),
    });

    // Emit WebSocket sync
    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'create', device: newDevice });
    }

    // Publish MQTT Birth event
    publishMqtt('ics/device/sync', { action: 'create', device: newDevice });

    const cleanDevice = {
      _id: newDevice._id,
      name: newDevice.name,
      type: newDevice.type,
      node_type: newDevice.node_type,
      zone: newDevice.zone,
      ip_address: newDevice.ipAddress,
      mac_address: newDevice.macAddress,
      parent_id: newDevice.parent_id,
      icon_path: newDevice.icon_path,
      hardware_model: newDevice.hardware_model,
      firmware_version: newDevice.firmware_version,
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
  const { name, type, ipAddress, ip_address, macAddress, description, status, zone, parent_id, node_type, icon_path, hardware_model, firmware_version } = req.body;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }

    if (name !== undefined) device.name = name;
    if (type !== undefined) device.type = type;
    if (description !== undefined) device.description = description;

    // Support visual variables update
    if (zone !== undefined) device.zone = zone;
    if (parent_id !== undefined) device.parent_id = parent_id;
    if (node_type !== undefined) device.node_type = node_type;
    if (icon_path !== undefined) device.icon_path = icon_path;
    if (hardware_model !== undefined) device.hardware_model = hardware_model;
    if (firmware_version !== undefined) device.firmware_version = firmware_version;

    const actualIp = ipAddress || ip_address;

    // Merge existing device data with incoming updates for validation
    const mergedData = {
      _id: device._id.toString(),
      name: name !== undefined ? name : device.name,
      ipAddress: actualIp !== undefined ? actualIp.trim() : device.ipAddress,
      macAddress: macAddress !== undefined ? macAddress.trim() : device.macAddress,
      node_type: node_type !== undefined ? node_type : device.node_type,
      status: status !== undefined ? status : device.status
    };

    const validationResult = validateDevice(mergedData);
    if (!validationResult.isValid) {
      return res.status(400).json({ error: 'Bad Request', message: 'Validation failed.', details: validationResult.errors });
    }

    if (actualIp !== undefined) {
      device.ipAddress = actualIp.trim();
      device.ip_address = actualIp.trim();
    }
    if (macAddress !== undefined) {
      device.macAddress = macAddress.trim();
      device.mac_address = macAddress.trim();
    }
    if (status !== undefined) {
      device.status = status;
    }

    await device.save();

    const cleanDevice = {
      _id: device._id,
      name: device.name,
      type: device.type,
      node_type: device.node_type,
      zone: device.zone,
      ip_address: device.ipAddress,
      mac_address: device.macAddress,
      parent_id: device.parent_id,
      icon_path: device.icon_path,
      hardware_model: device.hardware_model,
      firmware_version: device.firmware_version,
      description: device.description,
      status: device.status,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt
    };

    if (typeof socketService !== 'undefined') {
      socketService.emitDeviceStatusChanged(device);
      const io = socketService.getIo();
      if (io) {
        io.emit('DEVICE_SYNC', { action: 'update', device });
      }
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

    // Emit WebSocket sync
    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'delete', device_id: id });
    }

    // Publish MQTT Death event
    publishMqtt('ics/device/sync', { action: 'delete', device_id: id });

    return successResponse(res, null, 'Xóa thiết bị thành công');
  } catch (error) {
    console.error('DeleteDevice error:', error);
    return errorResponse(res, 'Failed to delete device', error.message);
  }
};

export const deleteMultipleDevices = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Danh sách ID thiết bị không hợp lệ', null, 400);
  }

  try {
    const result = await Device.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, `Xóa thành công ${result.deletedCount} thiết bị`);
  } catch (error) {
    console.error('DeleteMultipleDevices error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách thiết bị', error.message);
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
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const ipAddress = rawIp.includes('::ffff:') ? rawIp.split('::ffff:')[1] : rawIp;

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

export const provisionDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);
    if (device.status !== 'unprovisioned') {
      return errorResponse(res, 'Device is not in unprovisioned state', null, 400);
    }

    device.status = 'active';
    await device.save();

    const io = socketService.getIo();
    if (io) io.emit('DEVICE_SYNC', { action: 'update', device });

    // Publish MQTT to let Simulator start the simulation thread
    publishMqtt('ics/device/sync', { action: 'create', device });

    return successResponse(res, device, 'Cấp phép thiết bị thành công');
  } catch (error) {
    console.error('Provision error:', error);
    return errorResponse(res, 'Failed to provision device', error.message);
  }
};

export const decommissionDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);
    if (device.status !== 'offline') {
      return errorResponse(res, 'Only offline devices can be decommissioned', null, 400);
    }

    await device.deleteOne();

    const io = socketService.getIo();
    if (io) io.emit('DEVICE_SYNC', { action: 'delete', device_id: id });

    return successResponse(res, null, 'Hủy cấp phép thiết bị thành công');
  } catch (error) {
    console.error('Decommission error:', error);
    return errorResponse(res, 'Failed to decommission device', error.message);
  }
};

export const handleSimulatorHardwareCrud = async (req, res) => {
  const { action } = req.body;

  if (action === 'create') {
    const { device } = req.body;
    if (!device || !device.name || !device.ipAddress || !device.macAddress) {
      return res.status(400).json({ error: 'Bad Request', message: 'Tên, IP và MAC là bắt buộc.' });
    }

    try {
      let customId = device._id || device.id;
      if (!customId) {
        const nodeType = device.node_type || 'sensor';
        const count = await Device.countDocuments({ node_type: nodeType });
        customId = `${nodeType}-${String(count + 1).padStart(2, '0')}`;
      }

      // Check duplicate _id
      const existing = await Device.findById(customId);
      if (existing) {
        return res.status(400).json({ error: 'Conflict', message: `Mã thiết bị ${customId} đã tồn tại.` });
      }

      const newDevice = await Device.create({
        _id: customId,
        name: device.name,
        type: device.type || 'IoT Device',
        node_type: device.node_type || 'sensor',
        zone: device.zone || 'Zone-A',
        ipAddress: device.ipAddress,
        macAddress: device.macAddress,
        parent_id: device.parent_id || null,
        hardware_model: device.hardware_model || '',
        firmware_version: device.firmware_version || '',
        icon_path: device.icon_path || 'Cpu',
        status: 'unprovisioned', // Hardware simulator drop = physical plug-in = unprovisioned
        lastSeen: new Date()
      });

      // Emit WebSocket sync
      const io = socketService.getIo();
      if (io) {
        io.emit('DEVICE_SYNC', { action: 'create', device: newDevice });
      }

      // Do NOT publish MQTT create event yet, wait for provision

      return successResponse(res, { device: newDevice }, 'Cắm nóng thiết bị thành công', 201);
    } catch (err) {
      console.error('Simulator create error:', err);
      return errorResponse(res, 'Failed to commission device', err.message);
    }
  } else if (action === 'delete') {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'ID thiết bị là bắt buộc.' });
    }

    try {
      const device = await Device.findById(id);
      if (!device) {
        return res.status(404).json({ error: 'Not Found', message: 'Thiết bị không tồn tại.' });
      }

      // Instead of deleting, mark as offline
      device.status = 'offline';
      await device.save();

      // Emit WebSocket sync (as update, not delete, so UI knows it's offline)
      const io = socketService.getIo();
      if (io) {
        io.emit('DEVICE_SYNC', { action: 'update', device });
      }

      // Publish MQTT Death event (Simulator should kill its thread)
      publishMqtt('ics/device/sync', { action: 'delete', device_id: id });

      return successResponse(res, null, 'Rút dây mạng thiết bị thành công');
    } catch (err) {
      console.error('Simulator delete error:', err);
      return errorResponse(res, 'Failed to decommission device', err.message);
    }
  } else if (action === 'update') {
    const { id, device } = req.body;
    if (!id || !device) {
      return res.status(400).json({ error: 'Bad Request', message: 'ID và dữ liệu cập nhật là bắt buộc.' });
    }

    try {
      const existing = await Device.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Not Found', message: 'Thiết bị không tồn tại.' });
      }

      const allowedFields = ['name', 'hardware_model', 'firmware_version', 'icon_path'];
      const updateData = {};
      allowedFields.forEach(f => { if (device[f] !== undefined) updateData[f] = device[f]; });

      const updated = await Device.findByIdAndUpdate(id, { $set: updateData }, { new: true });

      const io = socketService.getIo();
      if (io) io.emit('DEVICE_SYNC', { action: 'update', device: updated });
      publishMqtt('ics/device/sync', { action: 'update', device: updated });

      return successResponse(res, { device: updated }, 'Cập nhật cấu hình thiết bị thành công');
    } catch (err) {
      console.error('Simulator update error:', err);
      return errorResponse(res, 'Failed to update device', err.message);
    }
  } else if (action === 'reconnect') {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Bad Request', message: 'ID thiết bị là bắt buộc.' });
    }

    try {
      const device = await Device.findById(id);
      if (!device) {
        return res.status(404).json({ error: 'Not Found', message: 'Thiết bị không tồn tại.' });
      }

      device.status = 'active';
      await device.save();

      const io = socketService.getIo();
      if (io) io.emit('DEVICE_SYNC', { action: 'update', device });
      publishMqtt('ics/device/sync', { action: 'create', device });

      return successResponse(res, { device }, 'Kết nối lại thiết bị thành công');
    } catch (err) {
      console.error('Simulator reconnect error:', err);
      return errorResponse(res, 'Failed to reconnect device', err.message);
    }
  } else {
    return res.status(400).json({ error: 'Bad Request', message: 'Hành động không hợp lệ.' });
  }
};

export default {
  getAllDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteMultipleDevices,
  isolateDeviceEndpoint,
  unisolateDeviceEndpoint,
  rollbackDeviceEndpoint,
  provisionDeviceEndpoint,
  decommissionDeviceEndpoint,
  handleSimulatorHardwareCrud,
};
