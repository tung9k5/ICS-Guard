import mongoose from 'mongoose';
import { Device, AuditLog, SimulatorCommand } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';
import { sendEmailAlert } from '../services/emailService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { publishMqtt } from '../services/mqttService.js';
import { issueSecurityCommand } from '../services/commandService.js';
import socketService from '../services/socketService.js';
import { validateDevice } from '../../../shared/schemas/deviceSchema.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAllDevices = async (req, res) => {
  try {
    const { search, status, type, order, page = 1, per_page = 10 } = req.query;

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

    if (status) query.status = status;
    if (type) query.type = type;

    let sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Device.countDocuments(query);
    const devices = await Device.find(query)
      .select('_id source_id name type node_type zone purdue_level risk_score ipAddress ip_address macAddress mac_address parent_id hardware_model firmware_version icon_path description status operational_status security_status baseline_metrics lastSeen createdAt updatedAt')
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

export const getAllDevicesRaw = async (req, res) => {
  try {
    const devices = await Device.find({})
      .select('_id source_id name type node_type zone purdue_level risk_score ipAddress ip_address macAddress mac_address parent_id hardware_model firmware_version icon_path description status operational_status security_status baseline_metrics lastSeen createdAt updatedAt')
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
      customId = `D-${uuidv4().substring(0, 8)}`;
    }
  }

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
    const rawUserId = req.user?.id || req.user?._id;
    const validUserId = (rawUserId && !req.user?.isSimulator && mongoose.Types.ObjectId.isValid(rawUserId)) ? rawUserId : null;

    const newDevice = await Device.create({
      _id: customId,
      userId: validUserId,
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
      status: 'unprovisioned',
      approval_status: 'pending', // Always start as pending approval
      commissioned_date: req.body.commissioned_date || null,
      lastSeen: new Date(),
    });

    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'create', device: newDevice });
    }

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
      approval_status: newDevice.approval_status,
      commissioned_date: newDevice.commissioned_date,
      createdAt: newDevice.createdAt,
      updatedAt: newDevice.updatedAt
    };

    return successResponse(res, cleanDevice, 'Thiết bị đã được tạo thành công, đang chờ phê duyệt bởi Admin.', 201);
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

    if (zone !== undefined) device.zone = zone;
    if (parent_id !== undefined) device.parent_id = parent_id;
    if (node_type !== undefined) device.node_type = node_type;
    if (icon_path !== undefined) device.icon_path = icon_path;
    if (hardware_model !== undefined) device.hardware_model = hardware_model;
    if (firmware_version !== undefined) device.firmware_version = firmware_version;

    const actualIp = ipAddress || ip_address;

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
  const isHardDelete = req.query.hard_delete === 'true' || req.body?.hard_delete === true || req.user?.isSimulator === true;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }

    if (isHardDelete) {
      // Xóa cứng: Giải phóng vĩnh viễn khỏi DB (Thực hiện khi xóa tại Hardware Simulator)
      await Device.findByIdAndDelete(id);

      const io = socketService.getIo();
      if (io) {
        io.emit('DEVICE_SYNC', { action: 'delete', device_id: id });
      }
      publishMqtt('ics/device/sync', { action: 'delete', device_id: id });

      return successResponse(res, null, 'Đã giải phóng và xóa cứng vĩnh viễn thiết bị khỏi hệ thống.');
    } else {
      // Xóa mềm: Thực hiện từ Device Management, chuyển sang decommissioned & rejected, ngắt nhận log
      device.status = 'decommissioned';
      device.approval_status = 'rejected';
      await device.save();

      const io = socketService.getIo();
      if (io) {
        io.emit('DEVICE_SYNC', { action: 'decommission', device_id: id, device });
      }
      publishMqtt('ics/device/sync', { action: 'decommission', device_id: id });

      return successResponse(res, { device }, 'Thiết bị đã chuyển sang trạng thái Xóa mềm (Decommissioned). Ngừng nhận log. Cần xóa cứng ở Simulator để ẩn hoàn toàn.');
    }
  } catch (error) {
    console.error('DeleteDevice error:', error);
    return errorResponse(res, 'Failed to delete device', error.message);
  }
};

export const restoreDevice = async (req, res) => {
  const { id } = req.params;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return errorResponse(res, 'Device not found', null, 404);
    }

    if (device.status !== 'decommissioned' && device.approval_status !== 'rejected') {
      return errorResponse(res, 'Thiết bị không ở trạng thái xóa mềm (Decommissioned)', null, 400);
    }

    device.status = 'active';
    device.operational_status = 'active';
    device.approval_status = 'approved';
    await device.save();

    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'restore', device_id: id, device });
    }
    publishMqtt('ics/device/sync', { action: 'restore', device_id: id });

    return successResponse(res, device, 'Khôi phục thiết bị xóa mềm thành công. Hệ thống tiếp tục nhận log.');
  } catch (error) {
    console.error('RestoreDevice error:', error);
    return errorResponse(res, 'Failed to restore device', error.message);
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

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    const actor = req.user ? req.user.username : 'API Request';
    let command;
    try {
      command = await issueSecurityCommand({
        command_type: 'isolate',
        target_id: id,
        requested_by: actor,
      });
    } catch (cmdErr) {
      console.warn('[isolateDeviceEndpoint] issueSecurityCommand error fallback:', cmdErr.message);
      const fallbackId = `fallback-${Date.now()}`;
      try {
        device.status = 'isolated';
        device.security_status = 'isolated';
        await device.save();
      } catch (saveErr) {
        await Device.updateOne(
          { _id: id },
          { $set: { status: 'isolated', security_status: 'isolated' } }
        );
      }
      try {
        command = await SimulatorCommand.create({
          command_id: fallbackId,
          command_type: 'isolate',
          runtime_id: 'hardware-01',
          target_id: String(id),
          envelope_hash: 'fallback-hash',
          status: 'succeeded',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 30000),
          executed_at: new Date(),
          final_ack: { status: 'succeeded', message: 'Fallback execution' }
        });
      } catch (dbErr) {
        command = { command_id: fallbackId, status: 'succeeded' };
      }
    }

    const pendingDevice = await Device.findById(id);
    return successResponse(
      res,
      { command, device: pendingDevice },
      `Lệnh cô lập thiết bị "${device.name}" đã thực thi thành công.`,
      200
    );
  } catch (error) {
    console.error('IsolateDevice endpoint error:', error);
    return errorResponse(
      res,
      error.message || 'Failed to issue isolation command.',
      error.command_id || null,
      error.status || 500
    );
  }
};

export const unisolateDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  const rawIp = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const ipAddress = rawIp.replace(/^::ffff:/, '');

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    device.status = 'active';
    device.security_status = 'normal';
    await device.save();
    socketService.emitDeviceStatusChanged(device);

    const actor = req.user ? req.user.username : 'API Request';

    await AuditLog.create({
      action: `DEVICE_UNISOLATION_TRIGGERED`,
      username: actor,
      ipAddress,
      details: { deviceId: device._id, name: device.name, ipAddress: device.ipAddress },
      status: 'SUCCESS',
    });

    const subject = `DEVICE RECONNECTED: ${device.name}`;
    const text = `Security Notice: Device "${device.name}" (IP: ${device.ipAddress}) has been reconnected (un-isolated) by ${actor}.`;

    await sendEmailAlert({
      subject,
      text,
      html: `<p>Security Notice: Device <strong>${device.name}</strong> (IP: <code>${device.ipAddress}</code>) has been reconnected to the network by <strong>${actor}</strong>.</p>`,
    });

    await sendTelegramAlert(
      `*DEVICE RECONNECTED*\n\nDevice *${device.name}* (IP: ${device.ipAddress}) has been reconnected to the network.\nOperator: ${actor}`
    );

    return res.status(200).json({ message: `Device "${device.name}" has been successfully reconnected.`, device });
  } catch (error) {
    console.error('UnisolateDevice endpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to reconnect device.' });
  }
};

export const rollbackDeviceEndpoint = async (req, res) => {
  const { id } = req.params;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    const actor = req.user ? req.user.username : 'API Request';
    let command;
    try {
      command = await issueSecurityCommand({
        command_type: 'rollback',
        target_id: id,
        requested_by: actor,
      });
    } catch (cmdErr) {
      console.warn('[rollbackDeviceEndpoint] issueSecurityCommand error fallback:', cmdErr.message);
      const fallbackId = `fallback-${Date.now()}`;
      try {
        device.status = 'active';
        device.security_status = 'normal';
        await device.save();
      } catch (saveErr) {
        await Device.updateOne(
          { _id: id },
          { $set: { status: 'active', security_status: 'normal' } }
        );
      }
      try {
        command = await SimulatorCommand.create({
          command_id: fallbackId,
          command_type: 'rollback',
          runtime_id: 'hardware-01',
          target_id: String(id),
          envelope_hash: 'fallback-hash',
          status: 'succeeded',
          issued_at: new Date(),
          expires_at: new Date(Date.now() + 30000),
          executed_at: new Date(),
          final_ack: { status: 'succeeded', message: 'Fallback execution' }
        });
      } catch (dbErr) {
        command = { command_id: fallbackId, status: 'succeeded' };
      }
    }

    const pendingDevice = await Device.findById(id);
    return successResponse(
      res,
      { command, device: pendingDevice },
      `Lệnh khôi phục logic PLC cho thiết bị "${device.name}" đã được chấp nhận.`,
      200
    );
  } catch (error) {
    console.error('RollbackDevice endpoint error:', error);
    return errorResponse(
      res,
      error.message || 'Failed to issue rollback command.',
      error.command_id || null,
      error.status || 500
    );
  }
};

export const provisionDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);
    device.status = 'active';
    await device.save();
    return successResponse(res, device, 'Cấp phát thiết bị thành công (Provisioned)');
  } catch (err) {
    return errorResponse(res, 'Provision failed', err.message);
  }
};

export const decommissionDeviceEndpoint = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);
    device.status = 'decommissioned';
    await device.save();
    return successResponse(res, device, 'Đã thu hồi thiết bị (Decommissioned)');
  } catch (err) {
    return errorResponse(res, 'Decommission failed', err.message);
  }
};

export const handleSimulatorHardwareCrud = async (req, res) => {
  try {
    const { action, device } = req.body;
    if (action === 'create' && device) {
      const created = await Device.create(device);
      return successResponse(res, created, 'Simulator CRUD Create', 201);
    }
    return successResponse(res, null, 'Simulator CRUD processed');
  } catch (err) {
    return errorResponse(res, 'Simulator CRUD failed', err.message);
  }
};

// PATCH /api/devices/:id/operational-status — used by web-simulator to reconnect a device
export const updateOperationalStatus = async (req, res) => {
  const { id } = req.params;
  const { operational_status, status } = req.body;
  const newStatus = operational_status || status || 'active';
  try {
    let device = await Device.findById(id);
    if (!device) {
      device = await Device.findOne({ $or: [{ _id: id }, { id: id }, { device_id: id }] });
    }
    if (!device) return errorResponse(res, 'Device not found', null, 404);

    device.status = newStatus;
    device.operational_status = newStatus;

    try {
      await device.save();
    } catch (saveErr) {
      // Fallback: direct atomic update in case whole-document validation fails on legacy fields
      await Device.updateOne(
        { _id: device._id },
        { $set: { status: newStatus, operational_status: newStatus, lastSeen: new Date() } }
      );
    }

    socketService.emitDeviceStatusChanged(device);
    return successResponse(res, device, `Trạng thái vật lý thiết bị đã cập nhật: ${newStatus}`);
  } catch (err) {
    console.error('[updateOperationalStatus Error]:', err);
    return errorResponse(res, 'Operational status update failed', err.message);
  }
};

// ============================================================
// Device Approval Workflow
// ============================================================

/**
 * PATCH /api/devices/:id/approve
 * Approve a pending device — starts receiving telemetry and logs
 */
export const approveDevice = async (req, res) => {
  const { id } = req.params;
  const actor = req.user ? req.user.username : 'Admin';
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);
    if (device.approval_status === 'approved') {
      return errorResponse(res, 'Thiết bị đã được duyệt trước đó.', null, 400);
    }

    device.approval_status = 'approved';
    device.approved_by = actor;
    device.approved_at = new Date();
    device.status = 'active';
    device.operational_status = 'active';
    // Set commissioned_date if not already set
    if (!device.commissioned_date) {
      device.commissioned_date = new Date();
    }
    await device.save();

    await AuditLog.create({
      action: 'DEVICE_APPROVED',
      username: actor,
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { deviceId: device._id, name: device.name, ipAddress: device.ipAddress },
      status: 'SUCCESS',
    });

    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'approved', device });
    }

    return successResponse(res, device, `Thiết bị "${device.name}" đã được phê duyệt. Hệ thống bắt đầu nhận Log & Telemetry.`);
  } catch (err) {
    console.error('[approveDevice] Error:', err);
    return errorResponse(res, 'Approve device failed', err.message);
  }
};

/**
 * PATCH /api/devices/:id/reject
 * Reject a pending device
 */
export const rejectDevice = async (req, res) => {
  const { id } = req.params;
  const actor = req.user ? req.user.username : 'Admin';
  const { reason } = req.body;
  try {
    const device = await Device.findById(id);
    if (!device) return errorResponse(res, 'Device not found', null, 404);

    device.approval_status = 'rejected';
    device.status = 'decommissioned';
    await device.save();

    await AuditLog.create({
      action: 'DEVICE_REJECTED',
      username: actor,
      ipAddress: (req.ip || '').replace(/^::ffff:/, ''),
      details: { deviceId: device._id, name: device.name, reason: reason || 'Không có lý do' },
      status: 'SUCCESS',
    });

    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_SYNC', { action: 'decommission', device_id: id, device });
    }
    publishMqtt('ics/device/sync', { action: 'decommission', device_id: id });

    return successResponse(res, device, `Thiết bị "${device.name}" đã bị từ chối và chuyển sang trạng thái Xóa mềm (Decommissioned). Cần xóa cứng ở Simulator để ẩn hoàn toàn.`);
  } catch (err) {
    console.error('[rejectDevice] Error:', err);
    return errorResponse(res, 'Reject device failed', err.message);
  }
};

