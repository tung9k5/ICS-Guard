import mqtt from 'mqtt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeTelemetry } from './influxService.js';
import { sendTelegramAlert } from './telegramService.js';
import { getActiveAdminSessions, addEmergencyAlert } from './sessionRegistry.js';
import socketService from './socketService.js';
import redisClient from '../config/redis.js';
import ruleEngineService from './ruleEngineService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

let mqttClient = null;

// AES-256-CBC Config for E2E Encryption
const AES_SECRET_KEY = process.env.AES_SECRET_KEY || "0123456789abcdef0123456789abcdef";
const AES_IV = process.env.AES_IV || "abcdef9876543210";

function decryptPayload(encryptedBase64) {
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_SECRET_KEY), Buffer.from(AES_IV));
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
}

export const connectMqtt = () => {
  const options = {
    queueQoSZero: false, // Prevent OOM by not queueing QoS 0 messages when offline
    queueLimit: 100 // Limit offline queue size
  };
  
  // Setup TLS configuration
  const caCertPath = path.resolve(__dirname, '../certs/ca.crt');
  const requireTls = process.env.REQUIRE_TLS === 'true' || MQTT_URL.includes('8883') || MQTT_URL.startsWith('mqtts');

  if (requireTls) {
    if (!fs.existsSync(caCertPath)) {
      // Fail-fast to prevent silent downgrade
      throw new Error(`[MqttService] CRITICAL: TLS is required but ca.crt is missing at ${caCertPath}. Halting application.`);
    }
    
    console.log(`[MqttService] Found CA Certificate at: ${caCertPath}. Configuring TLS...`);
    options.ca = fs.readFileSync(caCertPath);
    options.rejectUnauthorized = false; 
    
    // Update protocol and port for TLS
    if (MQTT_URL.startsWith('mqtt://')) {
      MQTT_URL = MQTT_URL.replace('mqtt://', 'mqtts://').replace(':1883', ':8883');
    }
  }

  console.log(`[MqttService] Connecting to MQTT Broker at: ${MQTT_URL}...`);
  const client = mqtt.connect(MQTT_URL, options);
  mqttClient = client;

  client.on('connect', () => {
    console.log(`[MqttService] Connected to MQTT Broker successfully.`);
    client.subscribe('ics/telemetry/#', (err) => {
      if (!err) {
        console.log('[MqttService] Subscribed to topic "ics/telemetry/#" successfully.');
      } else {
        console.error('[MqttService] Subscription failed:', err.message);
      }
    });
  });

  client.on('message', async (topic, message) => {
    try {
      let payload = JSON.parse(message.toString());
      
      // Decrypt E2E Payload if encrypted
      if (payload.encrypted_data) {
        payload = decryptPayload(payload.encrypted_data);
      }
      
      // 1. Write to InfluxDB
      await writeTelemetry(payload);
 
      // 2. Check metrics for anomalies
      await checkTelemetryAnomalies(payload);

      // 3. Process structured logs
      await processStructuredLogs(payload);
    } catch (error) {
      // Ignore parsing errors for non-json
    }
  });

  client.on('error', (err) => {
    console.error('[MqttService] Connection error:', err.message);
  });
};

export const publishMqtt = (topic, payload) => {
  if (mqttClient && mqttClient.connected) {
    const dataStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    // Encrypt E2E Payload
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_SECRET_KEY), Buffer.from(AES_IV));
    let encrypted = cipher.update(dataStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const securePayload = JSON.stringify({ encrypted_data: encrypted });
    
    mqttClient.publish(topic, securePayload, { qos: 1 });
    console.log(`[MqttService] Published securely to ${topic}`);
    return true;
  }
  console.error('[MqttService] MQTT Client not connected, publish failed.');
  return false;
};

const checkTelemetryAnomalies = async (payload) => {
  const { device_id, zone } = payload;
  if (!device_id) return;

  // Bypass checks if device is isolated/quarantined
  try {
    const cachedStatus = await redisClient.get(`device_status:${device_id}`);
    if (cachedStatus === 'isolated' || cachedStatus === 'quarantined') return;

    if (!cachedStatus) {
      const device = await Device.findById(device_id).lean();
      if (device) {
        await redisClient.setEx(`device_status:${device_id}`, 300, device.status); // Cache for 5 mins
        if (device.status === 'isolated' || device.status === 'quarantined') return;
      }
    }
  } catch (err) {
    console.error('[MqttService] Redis cache fallback:', err.message);
  }

  // Use Dynamic Rule Engine to find matched rules
  const matchedRules = await ruleEngineService.evaluateTelemetry(payload);

  for (const rule of matchedRules) {
    const alertKey = `alert:${rule.rule_name}:${device_id}`;
    let recentlyAlerted = false;
    try { recentlyAlerted = await redisClient.get(alertKey); } catch(e) {}

    // Throttle alert based on rule's time_window_seconds
    if (!recentlyAlerted) {
      try { await redisClient.setEx(alertKey, rule.time_window_seconds || 120, '1'); } catch(e) {}

      console.log(`⚠️ [Rule Engine] Matched Rule: ${rule.rule_name} on ${device_id}`);

      const alert = await Alert.create({
        rule_name: rule.rule_name,
        device_id,
        title: `Phát hiện bất thường: ${rule.rule_name} trên ${device_id}`,
        description: rule.description || `Hệ thống phát hiện vi phạm quy tắc ${rule.rule_name}.`,
        severity: rule.severity || 'HIGH',
        status: 'new',
        detected_at: new Date()
      });

      const incident = await Incident.create({
        title: `Sự cố: Vi phạm quy tắc bảo mật ${rule.rule_name} trên ${device_id}`,
        description: `Quy tắc ${rule.rule_name} đã bị vi phạm tại vùng ${zone || 'unknown'}. Chi tiết: ${rule.description}`,
        severity: rule.severity || 'HIGH',
        status: 'investigating',
        alert_ids: [alert._id]
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: 'Rule Engine',
        action_type: 'incident_created',
        description: `Tự động cảnh báo vi phạm quy tắc ${rule.rule_name}.`,
        metadata: { payload }
      });

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        console.log(`[AlertRouter] Active Admins online: ${activeAdmins.join(', ')}. Suppressing email/Telegram, adding to Emergency Queue.`);
        addEmergencyAlert({
          device_id,
          attack_type: rule.rule_name,
          message: `Thiết bị [${device_id}] vi phạm quy tắc [${rule.rule_name}] trong khi Admin [${activeAdmins.join(', ')}] đang trực tuyến!`,
          admin_users: activeAdmins
        });
      } else {
        console.log('[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.');
        const alertText = `🚨 *SECURITY ALERT: ${rule.rule_name}*\n\nDevice: *${device_id}*\nZone: *${zone || 'unknown'}*\nSeverity: *${rule.severity || 'HIGH'}*`;
        await sendTelegramAlert(alertText);
        await sendEmailAlert({
          subject: `[ICS-GUARD ALERT] ${rule.rule_name} on ${device_id}`,
          text: `Security Alert: Device ${device_id} in ${zone} violated rule ${rule.rule_name}.`,
          html: `<p><strong>Security Alert:</strong> Device <strong>${device_id}</strong> in <strong>${zone}</strong> violated rule <strong>${rule.rule_name}</strong>.</p>`
        });
      }
    }
  }
};

const processStructuredLogs = async (payload) => {
  const { device_id, zone, logs } = payload;
  if (!device_id || !logs || !Array.isArray(logs) || logs.length === 0) return;

  for (const log of logs) {
    const { event, log_level, source_ip, message } = log;
    
    // Only raise security Alerts/Incidents for WARN, ERROR, CRITICAL logs
    if (log_level === 'INFO') continue;

    // Map log event to Rule Name and Severity
    let rule_name = '';
    let severity = 'MEDIUM';
    let alert_title = '';

    if (event === 'OTA_HASH_MISMATCH') {
      rule_name = 'MALICIOUS_OTA_UPDATE';
      severity = 'CRITICAL';
      alert_title = `Tấn công nâng cấp Firmware độc hại trên ${device_id}`;
    } else if (event === 'WATCHDOG_RESET') {
      rule_name = 'DEVICE_CRASH_WDT';
      severity = 'HIGH';
      alert_title = `Thiết bị sập do Watchdog Reset trên ${device_id}`;
    } else if (event === 'SENSOR_SPOOFING_DETECTED') {
      rule_name = 'SENSOR_DATA_SPOOFING';
      severity = 'CRITICAL';
      alert_title = `Giả mạo dữ liệu cảm biến trên ${device_id}`;
    } else if (event === 'MOTOR_CURRENT_OVERLOAD') {
      rule_name = 'ACTUATOR_MOTOR_OVERLOAD';
      severity = 'HIGH';
      alert_title = `Quá tải động cơ thiết bị chấp hành ${device_id}`;
    } else if (event === 'UNAUTHORIZED_CMD') {
      rule_name = 'UNAUTHORIZED_ACTUATOR_COMMAND';
      severity = 'CRITICAL';
      alert_title = `Lệnh điều khiển trái phép trên ${device_id}`;
    } else if (event === 'FIRMWARE_CHECKSUM_ERROR' || event === 'SCAN_CYCLE_LIMIT_EXCEEDED') {
      rule_name = 'PLC_LOGIC_TAMPERING';
      severity = 'CRITICAL';
      alert_title = `Thay đổi logic điều khiển PLC trên ${device_id}`;
    } else if (event === 'ROUTE_MODIFIED') {
      rule_name = 'GATEWAY_ROUTE_POISONING';
      severity = 'CRITICAL';
      alert_title = `Đầu độc bảng định tuyến Gateway trên ${device_id}`;
    } else if (event === 'TLS_HANDSHAKE_FAILED') {
      rule_name = 'GATEWAY_WAN_DOS';
      severity = 'HIGH';
      alert_title = `Tấn công Từ chối dịch vụ (DoS) trên Gateway ${device_id}`;
    } else {
      // General anomaly fallback
      rule_name = 'GENERAL_ANOMALY';
      severity = log_level === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      alert_title = `Phát hiện hành vi bất thường trên ${device_id}`;
    }

    // Check recent alerts for this rule and device
    const now = Date.now();
    const recentAlert = await Alert.findOne({
      device_id,
      rule_name,
      status: 'new',
      detected_at: { $gt: new Date(now - 1.5 * 60 * 1000) }
    });

    if (!recentAlert) {
      console.log(`⚠️ [Anomaly Log Detection] Raised ${rule_name} on ${device_id}: ${message}`);
      
      const alert = await Alert.create({
        rule_name,
        device_id,
        title: alert_title,
        description: message,
        severity,
        status: 'new',
        source_ip: source_ip || '127.0.0.1',
        detected_at: new Date()
      });

      const incident = await Incident.create({
        title: `Sự cố: ${alert_title}`,
        description: `Hệ thống phát hiện nhật ký bảo mật nghiêm trọng gửi lên từ thiết bị ${device_id} tại vùng mạng ${zone || 'unknown'}: "${message}".`,
        severity,
        status: 'investigating',
        alert_ids: [alert._id]
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: 'Security Log Engine',
        action_type: 'incident_created',
        description: `Phát hiện mã sự kiện ${event}. Log: "${message}".`,
        metadata: { event, log_level, source_ip }
      });

      // Telegram / Email alerts
      const alertText = `🚨 *CRITICAL SECURITY ALERT: ${rule_name}*\n\nDevice: *${device_id}*\nZone: *${zone || 'unknown'}*\nEvent: *${event}*\nMessage: _${message}_\nSeverity: *${severity}*`;
      sendTelegramAlert(alertText).catch(err => console.error('[MqttService] Telegram send error:', err));
      sendEmailAlert({
        subject: `[ICS-GUARD CRITICAL] ${rule_name} on ${device_id}`,
        text: `Critical Alert: ${message} (Event: ${event})`,
        html: `<h3>Critical Security Alert</h3>
               <p><strong>Device:</strong> ${device_id}</p>
               <p><strong>Zone:</strong> ${zone || 'unknown'}</p>
               <p><strong>Event:</strong> ${event}</p>
               <p><strong>Log Details:</strong> ${message}</p>
               <p><strong>Action Taken:</strong> Flagged in SOC Dashboard and registered for AI analysis.</p>`
      }).catch(err => console.error('[MqttService] Email send error:', err));
    }
  }
};

export default {
  connectMqtt,
  publishMqtt
};
