import { Alert, Incident, IncidentTimeline, Device } from '../models/index.js';
import { registerFailedIpAttempt } from '../services/securityService.js';
import { sendEmailAlert } from '../services/emailService.js';
import { sendTelegramAlert } from '../services/telegramService.js';

// In-memory brute force tracker grouped by device_id + source_ip
// Format: { 'plc-water-01:185.220.101.45': [timestamp1, timestamp2, ...] }
const bruteForceAttempts = {};

export const ingestTelemetryLog = async (req, res) => {
  const { device_id, log_type, event, source_ip, username } = req.body;

  if (!device_id) {
    return res.status(400).json({ error: 'Bad Request', message: 'device_id is required.' });
  }

  try {
    // Check if device exists in Mongo, if not register/log warning
    const device = await Device.findOne({ device_id });
    const zone = device ? device.zone : 'unknown';

    if (log_type === 'auth' && event === 'AUTH_FAILED') {
      const now = Date.now();
      const ipKey = `${device_id}:${source_ip || 'unknown'}`;
      const timeWindowMs = 120 * 1000; // 2 minutes window

      if (!bruteForceAttempts[ipKey]) {
        bruteForceAttempts[ipKey] = [];
      }

      // Add attempt and clean old ones
      bruteForceAttempts[ipKey].push(now);
      bruteForceAttempts[ipKey] = bruteForceAttempts[ipKey].filter(ts => now - ts < timeWindowMs);

      const failedCount = bruteForceAttempts[ipKey].length;
      console.log(`[TelemetryController] Failed auth attempt on ${device_id} from ${source_ip}: ${failedCount}/10`);

      if (failedCount >= 10) {
        // Clear memory tracking
        delete bruteForceAttempts[ipKey];

        // 1. Auto-block the attacker IP in backend firewall middleware
        if (source_ip) {
          await registerFailedIpAttempt(source_ip);
        }

        // 2. Raise critical Alert in MongoDB
        const alert = await Alert.create({
          rule_name: 'DEVICE_BRUTE_FORCE',
          device_id,
          title: `Tấn công SSH Brute Force trên ${device_id}`,
          description: `Phát hiện hành vi brute force mật khẩu từ nguồn ngoài vào thiết bị ${device_id} (Đăng nhập sai ${failedCount} lần liên tiếp).`,
          severity: 'CRITICAL',
          status: 'new',
          source_ip,
          detected_at: new Date()
        });

        // 3. Create Incident
        const incident = await Incident.create({
          title: `Sự cố: Tấn công Brute Force vào thiết bị ${device_id}`,
          description: `Phát hiện tấn công dò mật khẩu SSH liên tục từ IP nguồn ${source_ip || 'unknown'} nhắm vào thiết bị ${device_id} tại phân vùng mạng ${zone}. Hệ thống đã kích hoạt cơ chế tự động chặn IP nguồn.`,
          severity: 'CRITICAL',
          status: 'investigating',
          alert_ids: [alert._id]
        });

        alert.incident_id = incident._id;
        await alert.save();

        // 4. Create Incident Timeline
        await IncidentTimeline.create({
          incident_id: incident._id,
          actor: 'Security Log Engine',
          action_type: 'incident_created',
          description: `Phát hiện hành vi brute force mật khẩu từ IP ${source_ip || 'unknown'} (Đăng nhập sai > 10 lần trong 2 phút).`,
          metadata: { source_ip, failedAttempts: failedCount }
        });

        // 5. Send Telegram and Email notifications
        const alertText = `🚨 *CRITICAL SECURITY ALERT: SSH BRUTE FORCE*\n\nDevice: *${device_id}*\nZone: *${zone}*\nAttacker IP: *${source_ip || 'unknown'}*\nAction: *IP Auto-Blocked*\nSeverity: *CRITICAL*`;
        
        await sendTelegramAlert(alertText, [
          { text: `🚫 Cô lập thiết bị ${device_id}`, callback_data: `quarantine_device:${device_id}` }
        ]);

        await sendEmailAlert({
          subject: `[ICS-GUARD CRITICAL] SSH Brute Force Attack on ${device_id}`,
          text: `Critical Alert: SSH Brute force attack detected on device ${device_id} from IP ${source_ip}. IP has been auto-blocked.`,
          html: `<h3>Critical Infrastructure Security Alert</h3>
                 <p>SSH Brute force attack detected on device <strong>${device_id}</strong> in <strong>${zone}</strong> from IP <strong>${source_ip}</strong>.</p>
                 <p><strong>Action Taken:</strong> Source IP address has been automatically blocked on application gateways.</p>`
        });
      }
    }

    return res.status(200).json({ status: 'success', message: 'Log ingested successfully.' });
  } catch (error) {
    console.error('[TelemetryController] Ingestion error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process telemetry log.' });
  }
};
