import { publishMqtt } from '../services/mqttService.js';
import { Device } from '../models/index.js';

export const launchAttack = async (req, res) => {
  const { device_id, attack_type } = req.body;

  if (!device_id || !attack_type) {
    return res.status(400).json({ error: 'Bad Request', message: 'device_id and attack_type are required.' });
  }

  try {
    const success = publishMqtt('ics/control/attack', { device_id, attack_type });
    if (success) {
      return res.status(200).json({ 
        status: 'success', 
        message: `Attack ${attack_type} launched successfully on ${device_id}.` 
      });
    } else {
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to publish attack command to broker.' 
      });
    }
  } catch (error) {
    console.error('[AttackController] Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const getAttackDevices = async (req, res) => {
  try {
    const devices = await Device.find({}, '_id type zone status');
    return res.status(200).json(devices);
  } catch (error) {
    console.error('[AttackController] Get devices error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};
