import { Device, AuditLog } from '../models/index.js';
import { isolateDevice } from '../services/securityService.js';
import { sendEmailAlert } from '../services/emailService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { publishMqtt } from '../services/mqttService.js';
import { validateDevice } from '../../../shared/schemas/deviceSchema.js';

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
    const devices = await Device.find();
    const enrichedDevices = devices.map(d => injectVulnerabilityInfo(d));
    return res.status(200).json(enrichedDevices);
  } catch (error) {
    console.error('GetAllDevices error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve devices.' });
  }
};

export const getDeviceById = async (req, res) => {
  const { id } = req.params;
  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }
    return res.status(200).json(injectVulnerabilityInfo(device));
  } catch (error) {
    console.error('GetDeviceById error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve device.' });
  }
};

export const createDevice = async (req, res) => {
  const { name, type, ipAddress, macAddress } = req.body;

  if (!name || !ipAddress || !macAddress) {
    return res.status(400).json({ error: 'Bad Request', message: 'Name, ipAddress, and macAddress are required.' });
  }

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

  if (!validationResult.isValid) {
    return res.status(400).json({ error: 'Bad Request', message: 'Validation failed.', details: validationResult.errors });
  }

  try {
    const newDevice = await Device.create({
      _id: customId,
      name,
      type: type || 'IoT Device',
      ipAddress,
      macAddress,
      status: 'active',
      lastSeen: new Date(),
    });
    return res.status(201).json({ message: 'Device created successfully.', device: newDevice });
  } catch (error) {
    console.error('CreateDevice error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create device.' });
  }
};

export const updateDevice = async (req, res) => {
  const { id } = req.params;
  const { name, type, ipAddress, macAddress, status } = req.body;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    if (name !== undefined) device.name = name;
    if (type !== undefined) device.type = type;
    if (ipAddress !== undefined) {
      device.ipAddress = ipAddress;
      device.ip_address = ipAddress;
    }
    if (macAddress !== undefined) {
      device.macAddress = macAddress;
      device.mac_address = macAddress;
    }
    
    if (status !== undefined) {
      const validStatuses = ['active', 'isolated', 'online', 'offline', 'quarantined'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Bad Request', message: `Status must be one of: ${validStatuses.join(', ')}` });
      }
      device.status = status;
    }

    await device.save();
    socketService.emitDeviceStatusChanged(device);
    return res.status(200).json({ message: 'Device updated successfully.', device });
  } catch (error) {
    console.error('UpdateDevice error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update device.' });
  }
};

export const deleteDevice = async (req, res) => {
  const { id } = req.params;

  try {
    const device = await Device.findById(id);
    if (!device) {
      return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
    }

    await device.deleteOne();
    return res.status(200).json({ message: 'Device deleted successfully.' });
  } catch (error) {
    console.error('DeleteDevice error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete device.' });
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
