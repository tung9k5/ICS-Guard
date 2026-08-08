import { Alert, Incident, IncidentTimeline, Device, BlockedIp } from '../models/index.js';
import { sendEmailAlert } from '../services/emailService.js';
import { publishMqtt } from '../services/mqttService.js';
import socketService from '../services/socketService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { getActiveAdminSessions, addEmergencyAlert } from '../services/sessionRegistry.js';
import { calculateAndUpdateRiskScore } from '../services/riskService.js';
import { parseSyslog, parseCSV } from '../utils/logParser.js';
import { writeTelemetry, writeDeviceEvent } from '../services/influxService.js';
import ruleEngineService from '../services/ruleEngineService.js';

export const getBlockedIpsPublic = async (req, res) => {
  try {
    const list = await BlockedIp.find({ expiresAt: { $gt: new Date() } });
    return res.status(200).json(list);
  } catch (err) {
    console.error('getBlockedIpsPublic error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// In-memory brute force tracker grouped by device_id + source_ip
// Format: { 'plc-water-01:185.220.101.45': [timestamp1, timestamp2, ...] }
const bruteForceAttempts = {};

const blockSourceIp = async (ipAddress, deviceId) => {
  if (!ipAddress) return null;
  const blockHours = Number.parseInt(process.env.IP_BLOCK_TIME_HOURS || '24', 10);
  const expiresAt = new Date(Date.now() + blockHours * 60 * 60 * 1000);
  return BlockedIp.findOneAndUpdate(
    { ipAddress },
    {
      ipAddress,
      reason: `Auto-blocked after brute-force detection against ${deviceId}`,
      expiresAt,
    },
    { upsert: true, new: true },
  );
};

export const ingestTelemetryLog = async (req, res) => {
  const { device_id, log_type, event, source_ip, username, timestamp } = req.body;

  // 1. Basic JSON Schema validation
  if (!device_id || typeof device_id !== 'string' || device_id.trim() === '') {
    return res.status(400).json({ error: 'Bad Request', message: 'device_id is required and must be a non-empty string.' });
  }

  if (log_type && typeof log_type !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'log_type must be a string.' });
  }

  if (event && typeof event !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'event must be a string.' });
  }

  if (source_ip && typeof source_ip !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'source_ip must be a string.' });
  }

  if (username && typeof username !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'username must be a string.' });
  }

  // 2. Replay Attack Protection via Timestamp Validation
  if (timestamp) {
    if (typeof timestamp !== 'string') {
      return res.status(400).json({ error: 'Bad Request', message: 'timestamp must be a string.' });
    }

    const logTime = new Date(timestamp);
    if (isNaN(logTime.getTime())) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid timestamp format.' });
    }

    const now = Date.now();
    const driftLimitMs = 5 * 60 * 1000; // 5 minutes clock drift / window

    if (Math.abs(now - logTime.getTime()) > driftLimitMs) {
      console.warn(`[TelemetryController] Replay Attack Blocked: timestamp drift is ${Math.abs(now - logTime.getTime())}ms. Payload timestamp: ${timestamp}, Server time: ${new Date().toISOString()}`);
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Telemetry log rejected due to timestamp validation failure (potential Replay Attack).'
      });
    }
  }

  try {
    // Check if device exists in Mongo and if it has been approved
    const device = await Device.findById(device_id).lean();
    const zone = device ? device.zone : 'unknown';

    if (device) {
      const isPending = device.approval_status === 'pending' || (device.status === 'unprovisioned' && device.approval_status !== 'approved');
      const isDecommissioned = device.status === 'decommissioned' || device.approval_status === 'rejected';
      if (isPending || isDecommissioned) {
        return res.status(202).json({
          status: 'pending_approval',
          message: `Thiết bị ${device_id} đang ở trạng thái chờ duyệt hoặc đã ngưng hoạt động. Nhật ký thiết bị không được ghi nhận.`
        });
      }
    }

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
          await blockSourceIp(source_ip, device_id);
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

        // 6. Phát sự kiện WebSocket
        socketService.emitNewAlert(alert);
        socketService.emitNewIncident(incident);

        // 5. Send notifications via appropriate channel (Smart Alert Routing)
        const activeAdmins = getActiveAdminSessions();
        if (activeAdmins.length > 0) {
          console.log(`[AlertRouter] Active Admins online: ${activeAdmins.join(', ')}. Suppressing email/Telegram, adding to Emergency Queue.`);
          addEmergencyAlert({
            device_id,
            attack_type: 'brute_force',
            message: `Đang có thiết bị [${device_id}] bị tấn công Brute Force và có người dùng Admin [${activeAdmins.join(', ')}] đang đăng nhập!`,
            admin_users: activeAdmins
          });
        } else {
          console.log('[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.');
          const alertText = `*CRITICAL SECURITY ALERT: SSH BRUTE FORCE*\n\nDevice: *${device_id}*\nZone: *${zone}*\nAttacker IP: *${source_ip || 'unknown'}*\nAction: *IP Auto-Blocked*\nSeverity: *CRITICAL*`;
          
          sendTelegramAlert(alertText, [
            { text: `Cô lập thiết bị ${device_id}`, callback_data: `isolate_device:${device_id}` }
          ]).catch(err => console.error('[TelemetryController] Telegram send error:', err));
          
          sendEmailAlert({
            subject: `[ICS-GUARD CRITICAL] SSH Brute Force Attack on ${device_id}`,
            text: `Critical Alert: SSH Brute force attack detected on device ${device_id} from IP ${source_ip}. IP has been auto-blocked.`,
            html: `<h3>Critical Infrastructure Security Alert</h3>
                   <p>SSH Brute force attack detected on device <strong>${device_id}</strong> in <strong>${zone}</strong> from IP <strong>${source_ip}</strong>.</p>
                   <p><strong>Action Taken:</strong> Source IP address has been automatically blocked on application gateways.</p>`
          }).catch(err => console.error('[TelemetryController] Email send error:', err));
        }
      }
    }

    // Update dynamic risk score in real-time
    if (device_id) {
      calculateAndUpdateRiskScore(device_id).catch(() => {});
    }

    return res.status(200).json({ status: 'success', message: 'Log ingested successfully.' });
  } catch (error) {
    console.error('[TelemetryController] Ingestion error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process telemetry log.' });
  }
};

export const controlAttackEndpoint = async (req, res) => {
  const { device_id, attack_type } = req.body;

  if (!device_id || typeof device_id !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'device_id is required and must be a string.' });
  }

  if (!attack_type || typeof attack_type !== 'string') {
    return res.status(400).json({ error: 'Bad Request', message: 'attack_type is required and must be a string.' });
  }

  try {
    console.log(`[TelemetryController] Dispatching attack control command for ${device_id}: ${attack_type}`);
    
    // Publish command to MQTT broker
    const success = publishMqtt('ics/control/attack', { device_id, attack_type });
    
    if (!success) {
      return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to publish control command to MQTT broker.' });
    }

    // If attack_type is stop, ensure the status of the device in MongoDB is set back to active.
    // Otherwise, set it to quarantined when under attack.
    if (attack_type === 'stop') {
      await Device.findByIdAndUpdate(device_id, { status: 'active' });
    } else {
      await Device.findByIdAndUpdate(device_id, { status: 'quarantined' });
    }

    return res.status(200).json({ status: 'success', message: `Command '${attack_type}' dispatched successfully to ${device_id}.` });
  } catch (error) {
    console.error('[TelemetryController] Control attack error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to dispatch attack command.' });
  }
};

/**
 * Xử lý chung dòng log/telemetry (cả từ REST, Syslog, CSV)
 */
const processTelemetryLogEntry = async (entry) => {
  const { device_id, log_type, event, source_ip, username, timestamp, metrics, message } = entry;
  const zone = entry.zone || 'Default-Zone';

  if (device_id) {
    const device = await Device.findById(device_id).select('approval_status status').lean();
    if (device) {
      const isPending = device.approval_status === 'pending' || (device.status === 'unprovisioned' && device.approval_status !== 'approved');
      const isDecommissioned = device.status === 'decommissioned' || device.approval_status === 'rejected';
      if (isPending || isDecommissioned) {
        return; // Device pending approval or decommissioned — drop log entry
      }
    }
  }

  // Save physical infrastructure log to InfluxDB if it's not a software auth/audit log
  if (log_type !== 'auth' && log_type !== 'user_action' && log_type !== 'audit') {
    let logMessage = message;
    if (!logMessage) {
      if (metrics) {
        logMessage = `Telemetry: ${Object.entries(metrics).map(([k, v]) => `${k}=${v}`).join(', ')}`;
      } else {
        logMessage = `${event || 'LOG'} event occurred on ${device_id}`;
      }
    }
    
    let severity = entry.severity || 'INFO';
    if (event && (event.includes('FAIL') || event.includes('ERROR') || event.includes('ATTACK') || event.includes('OVERFLOW') || event.includes('SPIKE'))) {
      severity = 'CRITICAL';
    } else if (event && (event.includes('WARN') || event.includes('HIGH') || event.includes('LOW'))) {
      severity = 'WARNING';
    }
    
    writeDeviceEvent({
      device_id,
      zone,
      log_type: log_type || 'telemetry',
      event: event || 'OPERATION',
      severity,
      source_ip,
      username,
      message: logMessage,
      timestamp: timestamp || new Date()
    }).catch(err => console.error('[TelemetryController] failed to write device event to Influx:', err));
  }

  // 1. Ghi InfluxDB và kiểm tra Rule Engine nếu chứa metrics đo lường
  if (metrics && Object.keys(metrics).length > 0) {
    try {
      await writeTelemetry({ device_id, zone, metrics, timestamp: timestamp || new Date() });
      
      const matchedRules = await ruleEngineService.evaluateTelemetry({ device_id, zone, metrics });
      for (const rule of matchedRules) {
        // Tạo Alert trong MongoDB
        const alert = await Alert.create({
          rule_name: rule.rule_name,
          device_id,
          title: rule.alert_title || `Phát hiện bất thường: ${rule.rule_name} trên ${device_id}`,
          description: rule.alert_description || rule.description || `Hệ thống phát hiện vi phạm quy tắc ${rule.rule_name}.`,
          severity: rule.severity,
          status: 'new',
          event_count: 1,
          raw_events_sample: [{ timestamp: new Date(), message: message || 'Rule threshold matched' }]
        });

        // Tìm hoặc tạo Incident liên quan
        const alertTitle = rule.alert_title || `Sự cố: Vi phạm quy tắc bảo mật ${rule.rule_name} trên ${device_id}`;
        let incident = await Incident.findOne({ title: alertTitle, status: { $in: ['open', 'investigating'] } });
        if (!incident) {
          incident = await Incident.create({
            title: alertTitle,
            description: rule.alert_description || `Quy tắc ${rule.rule_name} đã bị vi phạm tại vùng ${zone || 'unknown'}. Chi tiết: ${rule.description}`,
            severity: rule.severity,
            status: 'open',
            alert_ids: [alert._id]
          });
          await IncidentTimeline.create({
            incident_id: incident._id,
            actor: 'System',
            action_type: 'rule_trigger',
            description: `Sự cố được kích hoạt tự động từ thiết bị ${device_id} do khớp quy tắc giám sát.`
          });
        } else {
          incident.alert_ids.push(alert._id);
          await incident.save();
        }

        alert.incident_id = incident._id;
        await alert.save();

        // Đồng bộ thời gian thực qua socket
        socketService.emitNewAlert(alert);
        socketService.emitNewIncident(incident);
      }
    } catch (err) {
      console.error('[TelemetryController] Error processing metrics entry:', err.message);
    }
  }

  // 2. Chặn brute force nếu log dạng auth failed
  if (log_type === 'auth' && event === 'AUTH_FAILED') {
    const now = Date.now();
    const ipKey = `${device_id}:${source_ip || 'unknown'}`;
    const timeWindowMs = 120 * 1000;

    if (!bruteForceAttempts[ipKey]) {
      bruteForceAttempts[ipKey] = [];
    }

    bruteForceAttempts[ipKey].push(now);
    bruteForceAttempts[ipKey] = bruteForceAttempts[ipKey].filter(ts => now - ts < timeWindowMs);

    const failedCount = bruteForceAttempts[ipKey].length;
    console.log(`[TelemetryController] Syslog/CSV auth failed on ${device_id} from ${source_ip}: ${failedCount}/10`);

    if (failedCount >= 10) {
      delete bruteForceAttempts[ipKey];

      if (source_ip) {
        await blockSourceIp(source_ip, device_id);
      }

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

      const incident = await Incident.create({
        title: `Sự cố: Tấn công Brute Force vào thiết bị ${device_id}`,
        description: `Phát hiện tấn công dò mật khẩu SSH liên tục từ IP nguồn ${source_ip || 'unknown'} nhắm vào thiết bị ${device_id} tại phân vùng mạng ${zone}. Hệ thống đã kích hoạt cơ chế tự động chặn IP nguồn.`,
        severity: 'CRITICAL',
        status: 'investigating',
        alert_ids: [alert._id]
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: 'Security Log Engine',
        action_type: 'incident_created',
        description: `Phát hiện hành vi brute force mật khẩu từ IP ${source_ip || 'unknown'} (Đăng nhập sai > 10 lần trong 2 phút).`,
        metadata: { source_ip, failedAttempts: failedCount }
      });

      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        addEmergencyAlert({ device_id, attack_type: 'brute_force', admin_users: activeAdmins });
      } else {
        const alertText = `*CRITICAL SECURITY ALERT: SSH BRUTE FORCE*\n\nDevice: *${device_id}*\nZone: *${zone}*\nAttacker IP: *${source_ip || 'unknown'}*\nAction: *IP Auto-Blocked*\nSeverity: *CRITICAL*`;
        sendTelegramAlert(alertText, [
          { text: `Cô lập thiết bị ${device_id}`, callback_data: `isolate_device:${device_id}` }
        ]).catch(() => {});
        
        sendEmailAlert({
          subject: `[ICS-GUARD CRITICAL] SSH Brute Force Attack on ${device_id}`,
          text: `Critical Alert: SSH Brute force attack detected on device ${device_id} from IP ${source_ip}. IP has been auto-blocked.`,
          html: `<h3>Critical Infrastructure Security Alert</h3>`
        }).catch(() => {});
      }
    }
  }

  // 3. Tính toán lại Risk Score thời gian thực
  if (device_id) {
    calculateAndUpdateRiskScore(device_id).catch(() => {});
  }
};

export const ingestSyslogEndpoint = async (req, res) => {
  try {
    const rawLog = req.body.log || req.body.message || (typeof req.body === 'string' ? req.body : null);
    if (!rawLog) {
      return res.status(400).json({ error: 'Bad Request', message: 'No syslog content provided.' });
    }

    const payload = parseSyslog(rawLog);
    if (!payload) {
      return res.status(400).json({ error: 'Bad Request', message: 'Failed to parse syslog content.' });
    }

    await processTelemetryLogEntry(payload);

    return res.status(200).json({ status: 'success', message: 'Syslog parsed and ingested successfully.', data: payload });
  } catch (error) {
    console.error('ingestSyslogEndpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};

export const ingestCsvEndpoint = async (req, res) => {
  try {
    const csvContent = req.body.csv || (typeof req.body === 'string' ? req.body : null);
    if (!csvContent) {
      return res.status(400).json({ error: 'Bad Request', message: 'No CSV content provided.' });
    }

    const entries = parseCSV(csvContent);
    if (entries.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No valid rows parsed from CSV.' });
    }

    for (const entry of entries) {
      await processTelemetryLogEntry(entry);
    }

    return res.status(200).json({ status: 'success', message: `Parsed and processed ${entries.length} log entries from CSV.`, count: entries.length });
  } catch (error) {
    console.error('ingestCsvEndpoint error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};


