import express from 'express';
import { publishMqtt } from '../services/mqttService.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { ROLES } from '../constants/index.js';
import { Device, Alert, Incident, IncidentTimeline } from '../models/index.js';
import idGeneratorService from '../services/idGeneratorService.js';
import socketService from '../services/socketService.js';
import { ALERT_STATUSES, INCIDENT_STATUSES, SEVERITY_LEVELS, INCIDENT_TIMELINE_TYPES } from '../constants/index.js';

const router = express.Router();

// Get simulator status
router.get('/status', authMiddleware, authorize([ROLES.ADMIN, ROLES.CUSTOMER]), (req, res) => {
  res.json({
    status: 'online',
    message: 'IoT Simulator is running.'
  });
});

// Change scenario for a device
router.post('/scenario', authMiddleware, authorize([ROLES.ADMIN, ROLES.CUSTOMER]), async (req, res) => {
  const { device_id, scenario, severity } = req.body;
  if (!device_id || !scenario) {
    return res.status(400).json({ error: 'device_id and scenario are required' });
  }

  let deviceType = 'SENSOR';
  const device = await Device.findById(device_id);
  if (device) {
    if (req.user.role !== ROLES.ADMIN && String(device.userId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: Device does not belong to you' });
    }
    deviceType = device.type || device.node_type || 'SENSOR';
  } else if (req.user.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Forbidden: Device not found' });
  }

  // Publish to control topic which simulator listens to
  publishMqtt(`ics/control/simulator`, { device_id, scenario, device_type: deviceType });

  // Update scenario state in DB
  try {
    const updateData = { 
      current_scenario: scenario,
      current_severity: severity || 'HIGH',
      scenario_start_time: scenario === 'NORMAL' ? null : new Date()
    };
    await Device.findOneAndUpdate({ _id: device_id }, updateData);
  } catch (err) {
    console.error(`[SimulatorRoute] Failed to update device ${device_id} scenario in DB:`, err);
  }

  // Explicitly generate OFFLINE alert
  if (scenario === 'OFFLINE') {
    try {
      const device = await Device.findById(device_id);
      if (device) {
        const type = (device.type || '').toLowerCase();
        const severity = ['gateway', 'controller', 'plc'].includes(type) ? SEVERITY_LEVELS.CRITICAL : SEVERITY_LEVELS.LOW;

        const alert_code = await idGeneratorService.generate('alerts');
        const alert = await Alert.create({
          alert_code,
          rule_name: 'CONNECTION_LOSS',
          device_id,
          title: `Thiết bị ${device_id} mất kết nối`,
          description: `Không nhận được tín hiệu heartbeat từ thiết bị ${device_id} trong thời gian dài.`,
          severity,
          status: ALERT_STATUSES.NEW,
          detected_at: new Date()
        });

        const incident_code = await idGeneratorService.generate('incidents');
        const incident = await Incident.create({
          incident_code,
          title: `Sự cố: Mất kết nối thiết bị ${device_id}`,
          description: `Hệ thống ghi nhận mất kết nối hoàn toàn với thiết bị ${device_id} tại vùng ${device.zone || 'unknown'}. Có thể do mất điện, hỏng hóc vật lý hoặc tấn công cắt đứt mạng.`,
          severity,
          status: INCIDENT_STATUSES.INVESTIGATING,
          alert_ids: [alert._id]
        });

        alert.incident_id = incident._id;
        await alert.save();

        await IncidentTimeline.create({
          incident_id: incident._id,
          actor: 'Rule Engine',
          action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
          description: `Phát hiện mất kết nối. Tự động cảnh báo và tạo sự cố.`,
          metadata: { scenario: 'OFFLINE' }
        });

        socketService.emitNewAlert(alert);
        socketService.emitNewIncident(incident);
      }
    } catch (err) {
      console.error(`[SimulatorRoute] Failed to generate OFFLINE alert for ${device_id}:`, err);
    }
  }
  
  res.json({ success: true, message: `Scenario ${scenario} requested for ${device_id}` });
});

export default router;
