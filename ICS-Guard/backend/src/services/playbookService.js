import { Playbook, Device, BlockedIp, IncidentTimeline, AuditLog } from '../models/index.js';
import redisClient from '../config/redis.js';
import { issueSecurityCommand } from './commandService.js';
import { sendTelegramAlert } from './telegramService.js';
import { sendEmailAlert } from './emailService.js';

const DEFENSE_AGENT_URL = process.env.DEFENSE_AGENT_URL || '';
const DEFENSE_AGENT_KEY = process.env.DEFENSE_AGENT_KEY || '';

/**
 * Execute all active playbooks triggered by a specific rule on a target device.
 * @param {string} rule_name
 * @param {string} device_id
 * @param {object} context  — e.g. { source_ip, incident_id, severity, alert_title }
 */
export const executePlaybook = async (rule_name, device_id, context = {}) => {
  try {
    const playbooks = await Playbook.find({ trigger_rule: rule_name, is_active: true });
    if (!playbooks.length) return false;

    console.log(`[Playbook] Executing ${playbooks.length} playbook(s) for rule: ${rule_name} on device: ${device_id}`);

    for (const pb of playbooks) {
      for (const action of pb.actions) {
        let actionResult = { status: 'succeeded' };
        const actionType = action.action_type;

        try {
          if (actionType === 'isolate_device') {
            console.log(`[Playbook:${pb.name}] Action: Isolating device ${device_id}`);
            // 1. Database & Redis status update
            await Device.findByIdAndUpdate(device_id, { status: 'isolated' });
            try { await redisClient.setEx(`device_status:${device_id}`, 300, 'isolated'); } catch {}

            // 2. Issue bounded security command (MQTT + Defense Agent layer-3 disconnect)
            try {
              await issueSecurityCommand({
                command_type: 'isolate',
                target_id: String(device_id),
                requested_by: `Playbook:${pb.name}`,
                correlation: rule_name
              });
            } catch (cmdErr) {
              console.warn(`[Playbook:${pb.name}] issueSecurityCommand warning: ${cmdErr.message}`);
            }

            // AUDIT: Auto isolation by SOAR
            try {
              await AuditLog.create({
                action: 'AUTO_SOAR_ISOLATE_DEVICE',
                username: `Playbook:${pb.name}`,
                ipAddress: 'Internal-SOAR',
                details: { device_id, playbook_id: String(pb._id), rule_name, context },
                status: 'SUCCESS',
              });
            } catch (auditErr) { console.warn('[Playbook] AuditLog write failed:', auditErr.message); }

          } else if (actionType === 'send_email') {
            console.log(`[Playbook:${pb.name}] Action: Sending email notification for rule ${rule_name}`);
            await sendEmailAlert({
              subject: `[ICS-GUARD SOAR PLAYBOOK] Auto-triggered rule ${rule_name} on ${device_id}`,
              text: `Playbook ${pb.name} executed send_email action. Rule ${rule_name} matched on device ${device_id}.`,
              html: `<h3>ICS-Guard SOAR Playbook Execution</h3>
                     <p>Playbook <strong>${pb.name}</strong> triggered automatically.</p>
                     <p>Rule <strong>${rule_name}</strong> was matched on device <strong>${device_id}</strong>.</p>`
            });

          } else if (actionType === 'block_ip') {
            const targetIp = context.source_ip || context.ip_address;
            if (targetIp) {
              console.log(`[Playbook:${pb.name}] Action: Blocking source IP ${targetIp}`);
              // 1. Block in MongoDB
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + 24);
              await BlockedIp.findOneAndUpdate(
                { ipAddress: targetIp },
                { ipAddress: targetIp, reason: `Playbook ${pb.name} auto-block for rule ${rule_name}`, expiresAt },
                { upsert: true, new: true }
              );

              // AUDIT: Auto IP block by SOAR
              try {
                await AuditLog.create({
                  action: 'AUTO_SOAR_BLOCK_IP',
                  username: `Playbook:${pb.name}`,
                  ipAddress: 'Internal-SOAR',
                  details: { blocked_ip: targetIp, device_id, rule_name, expires_at: expiresAt },
                  status: 'SUCCESS',
                });
              } catch (auditErr) { console.warn('[Playbook] AuditLog write failed:', auditErr.message); }

              // 2. Call Defense Agent layer-3 block
              if (DEFENSE_AGENT_URL && DEFENSE_AGENT_KEY) {
                try {
                  await fetch(`${DEFENSE_AGENT_URL}/api/enforce/block-ip`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${DEFENSE_AGENT_KEY}`
                    },
                    body: JSON.stringify({ source_ip: targetIp, requested_by: `Playbook:${pb.name}` }),
                    signal: AbortSignal.timeout(5000)
                  });
                } catch (err) {
                  console.warn(`[Playbook] Defense Agent block_ip call warning: ${err.message}`);
                }
              }
            }

          } else if (actionType === 'notify_telegram' || actionType === 'send_telegram') {
            console.log(`[Playbook:${pb.name}] Action: Dispatching Telegram alert`);
            const msg = `[SOAR PLAYBOOK AUTO] Rule *${rule_name}* trên thiết bị *${device_id}*.\nHành động: *${actionType}*\nMức độ: *${context.severity || 'CRITICAL'}*`;
            await sendTelegramAlert(msg);
          }

          // Timeline Audit Record
          if (context.incident_id) {
            await IncidentTimeline.create({
              incident_id: context.incident_id,
              actor: `Playbook:${pb.name}`,
              action_type: 'playbook_execution',
              description: `Tự động thực thi SOAR Action "${actionType}" cho quy tắc "${rule_name}" (Trạng thái: THÀNH CÔNG)`,
              metadata: { playbook_id: pb._id, action_type: actionType, rule_name, device_id }
            });
          }

        } catch (actionErr) {
          console.error(`[Playbook:${pb.name}] Action ${actionType} failed:`, actionErr);
        }
      }
    }
    return true;
  } catch (err) {
    console.error('[Playbook] Execution Error:', err);
    return false;
  }
};

export default { executePlaybook };
