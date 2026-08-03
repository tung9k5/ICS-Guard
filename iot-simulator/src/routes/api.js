import express from 'express';
import { simulatorManager } from '../scheduler/index.js';
import { DEVICE_STATUSES } from '../constants/index.js';

const router = express.Router();

// GET all devices with live metrics and local logs
router.get('/devices', (req, res) => {
  const devices = simulatorManager.getAllDevices().map(d => {
    // Generate payload to keep internal metrics updated
    const payload = d.generatePayload();
    return {
      id: d.id,
      name: d.name,
      type: d.type,
      zone: d.zone,
      isPowerConnected: d.isPowerConnected,
      isNetworkConnected: d.isNetworkConnected,
      activeAttacks: d.activeAttacks,
      logs: d.logs,
      approvalStatus: d.approvalStatus,
      ipAddress: d.ipAddress,
      macAddress: d.macAddress,
      intervalMs: d.intervalMs,
      metrics: payload ? payload.metrics : { battery: d.battery, bytes_per_second: 0 }
    };
  });
  res.json(devices);
});

// POST to create a new device dynamically (Default PENDING status)
router.post('/devices', (req, res) => {
  const { type, id, name, zone, x, y } = req.body;
  if (!type || !id || !name || !zone) {
    return res.status(400).json({ error: 'Missing required parameters: type, id, name, zone.' });
  }
  const cleanId = id.trim().toLowerCase().replace(/\s+/g, '-');
  const newDevice = simulatorManager.addDevice(type, cleanId, name, zone, parseFloat(x) || 0, parseFloat(y) || 0);
  if (!newDevice) {
    return res.status(400).json({ error: `Device with ID ${cleanId} already exists.` });
  }
  res.json({ success: true, device: { id: newDevice.id, name: newDevice.name } });
});

// POST to update device position
router.post('/devices/:id/position', (req, res) => {
  const device = simulatorManager.getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  const { x, y } = req.body;
  if (x !== undefined) device.x = parseFloat(x);
  if (y !== undefined) device.y = parseFloat(y);
  simulatorManager.saveState();
  res.json({ success: true });
});

// DELETE to remove a device dynamically
router.delete('/devices/:id', (req, res) => {
  const success = simulatorManager.removeDevice(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  res.json({ success: true });
});

// POST to approve a device (PENDING -> APPROVED)
router.post('/devices/:id/approve', (req, res) => {
  const device = simulatorManager.getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  device.approvalStatus = 'APPROVED';
  device.addLog('INFO', `LOGICAL_ACTION: Device ${device.id} approved by remote administrator. Operational loop active.`);
  simulatorManager.saveState();
  res.json({ success: true });
});

// POST to configure device parameters
router.post('/devices/:id/configure', (req, res) => {
  const device = simulatorManager.getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  
  const { name, ipAddress, macAddress, zone, intervalMs } = req.body;
  
  if (name) device.name = name;
  if (ipAddress) device.ipAddress = ipAddress;
  if (macAddress) device.macAddress = macAddress;
  if (zone) device.zone = zone;
  if (intervalMs) device.intervalMs = parseInt(intervalMs) || 5000;
  
  device.addLog('INFO', `LOGICAL_ACTION: Device configuration updated: Name=${device.name}, IP=${device.ipAddress}, MAC=${device.macAddress}, Zone=${device.zone}.`);
  simulatorManager.saveState();
  res.json({ success: true });
});

// POST to control physical parameters (cable cắm/rút, nguồn bật/tắt)
router.post('/devices/:id/control', (req, res) => {
  const device = simulatorManager.getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }
  
  const { power } = req.body;
  
  if (power !== undefined) {
    const isPower = !!power;
    device.isPowerConnected = isPower;
    device.addLog('INFO', `PHYSICAL_ACTION: Power cable ${isPower ? 'PLUGGED IN' : 'UNPLUGGED'}.`);
    
    if (!isPower) {
      device.clearAllAttacks();
      device.status = DEVICE_STATUSES.OFFLINE;
    } else {
      device.status = DEVICE_STATUSES.ACTIVE;
    }
    simulatorManager.recalculateNetworkConnections();
    simulatorManager.saveState();
  }
  
  res.json({ success: true });
});

// GET all connections (cables)
router.get('/connections', (req, res) => {
  res.json(simulatorManager.getConnections());
});

// POST to add connection
router.post('/connections', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from or to parameters.' });
  }
  const success = simulatorManager.addConnection(from, to);
  if (!success) {
    return res.status(400).json({ error: 'Connection already exists or invalid targets.' });
  }
  res.json({ success: true });
});

// DELETE to remove connection
router.post('/connections/delete', (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from or to parameters.' });
  }
  const success = simulatorManager.removeConnection(from, to);
  if (!success) {
    return res.status(404).json({ error: 'Connection not found.' });
  }
  res.json({ success: true });
});

// GET all zones
router.get('/zones', (req, res) => {
  res.json(simulatorManager.getZones());
});

// POST to create zone
router.post('/zones', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing zone name.' });
  }
  const success = simulatorManager.addZone(name);
  if (!success) {
    return res.status(400).json({ error: 'Zone already exists.' });
  }
  res.json({ success: true });
});

// DELETE to remove zone
router.delete('/zones/:name', (req, res) => {
  simulatorManager.removeZone(req.params.name);
  res.json({ success: true });
});

// POST to launch attacks
router.post('/attacks/launch', (req, res) => {
  const { deviceIds, attackType } = req.body;
  if (!deviceIds || !Array.isArray(deviceIds) || !attackType) {
    return res.status(400).json({ error: 'Invalid parameters. Need deviceIds[] and attackType.' });
  }

  deviceIds.forEach(id => {
    const device = simulatorManager.getDevice(id);
    if (device) {
      device.triggerAttack(attackType);
    }
  });

  res.json({ success: true });
});

// POST to stop attacks
router.post('/attacks/stop', (req, res) => {
  const { deviceIds, attackType } = req.body;
  if (!deviceIds || !Array.isArray(deviceIds)) {
    return res.status(400).json({ error: 'Invalid parameters. Need deviceIds[].' });
  }

  deviceIds.forEach(id => {
    const device = simulatorManager.getDevice(id);
    if (device) {
      if (attackType) {
        device.stopAttack(attackType);
      } else {
        device.clearAllAttacks();
      }
    }
  });

  res.json({ success: true });
});

// POST to physically mitigate fire/flood/overheat
router.post('/devices/:id/mitigate', (req, res) => {
  const device = simulatorManager.getDevice(req.params.id);
  if (!device) {
    return res.status(404).json({ error: 'Device not found.' });
  }

  const { incidentType } = req.body;
  if (!incidentType) {
    return res.status(400).json({ error: 'Missing incidentType.' });
  }

  device.mitigate(incidentType);
  res.json({ success: true });
});

export default router;
