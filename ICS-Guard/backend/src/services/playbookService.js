import { Playbook, Device } from '../models/index.js';
import redisClient from '../config/redis.js';

export const executePlaybook = async (rule_name, device_id, context = {}) => {
  try {
    const playbooks = await Playbook.find({ trigger_rule: rule_name, is_active: true });
    if (!playbooks.length) return false;

    console.log(`[Playbook] Executing ${playbooks.length} playbook(s) for rule: ${rule_name} on device: ${device_id}`);
    
    for (const pb of playbooks) {
      for (const action of pb.actions) {
        if (action.action_type === 'isolate_device') {
          console.log(`[Playbook] Action: Isolating device ${device_id}`);
          await Device.findByIdAndUpdate(device_id, { status: 'isolated' });
          await redisClient.setEx(`device_status:${device_id}`, 300, 'isolated');
        } else if (action.action_type === 'send_email') {
          console.log(`[Playbook] Action: Sending email notification`);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[Playbook] Execution Error:', err);
    return false;
  }
};
