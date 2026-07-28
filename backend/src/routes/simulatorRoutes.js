import express from 'express';
import { publishMqtt } from '../services/mqttService.js';
import authMiddleware from '../middlewares/authMiddleware.js';
import { authorize } from '../middlewares/rbacMiddleware.js';
import { ROLES } from '../constants/index.js';
import Device from '../models/device.js';

const router = express.Router();

// Get simulator status
router.get('/status', authMiddleware, authorize(ROLES.ADMIN), (req, res) => {
  res.json({
    status: 'online',
    message: 'IoT Simulator is running.'
  });
});

// Change scenario for a device
router.post('/scenario', authMiddleware, authorize(ROLES.ADMIN), async (req, res) => {
  const { device_id, scenario } = req.body;
  if (!device_id || !scenario) {
    return res.status(400).json({ error: 'device_id and scenario are required' });
  }

  // Publish to control topic which simulator listens to
  publishMqtt(`ics/control/simulator`, { device_id, scenario });

  // Update scenario state in DB
  try {
    const updateData = { 
      current_scenario: scenario,
      scenario_start_time: scenario === 'NORMAL' ? null : new Date()
    };
    await Device.findOneAndUpdate({ _id: device_id }, updateData);
  } catch (err) {
    console.error(`[SimulatorRoute] Failed to update device ${device_id} scenario in DB:`, err);
  }
  
  res.json({ success: true, message: `Scenario ${scenario} requested for ${device_id}` });
});

export default router;
