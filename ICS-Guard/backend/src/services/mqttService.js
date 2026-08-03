import mqtt from 'mqtt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeTelemetry, writeDeviceEvent } from './influxService.js';
import { sendTelegramAlert } from './telegramService.js';
import { sendEmailAlert } from './emailService.js';
import { getActiveAdminSessions, addEmergencyAlert } from './sessionRegistry.js';
import socketService from './socketService.js';
import redisClient from '../config/redis.js';
import ruleEngineService from './ruleEngineService.js';
import { executePlaybook } from './playbookService.js';
import { Device, Alert, Incident, IncidentTimeline } from '../models/index.js';
import { calculateAndUpdateRiskScore } from './riskService.js';
import { applyHardwareSnapshot } from './snapshotService.js';
import { processCommandAck } from './commandService.js';
import { processPolicyAck } from './otPolicyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

let mqttClient = null;

// AES-256-CBC Config for E2E Encryption
export function decryptPayload(payloadObj) {
    const aesSecret = process.env.AES_SECRET_KEY;
    const aesIv = process.env.AES_IV;
    let encryptedData = typeof payloadObj === 'string' ? payloadObj : payloadObj.encrypted_data;
    const iv = payloadObj && payloadObj.iv;
    const authTag = payloadObj && payloadObj.auth_tag;
    const alg = payloadObj && payloadObj.alg;

    if (alg === 'AES-256-GCM' || (iv && authTag)) {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            Buffer.from(aesSecret),
            Buffer.from(iv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(authTag, 'base64'));
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    } else {
        const decipher = crypto.createDecipheriv(
            'aes-256-cbc',
            Buffer.from(aesSecret),
            Buffer.from(aesIv)
        );
        let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
    }
}

export const connectMqtt = () => {
  const options = {
    clientId: process.env.MQTT_CLIENT_ID || `ics-backend-${process.pid}`,
    queueQoSZero: false, // Prevent OOM by not queueing QoS 0 messages when offline
    queueLimit: 100 // Limit offline queue size
  };
  const mqttUsername = process.env.MQTT_USERNAME || process.env.MQTT_USER;
  const mqttPassword = process.env.MQTT_PASSWORD;
  if (mqttUsername && mqttPassword) {
    options.username = mqttUsername;
    options.password = mqttPassword;
  } else if (process.env.NODE_ENV !== 'test') {
    throw new Error('[MqttService] MQTT_USERNAME and MQTT_PASSWORD are required.');
  }
  
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
    options.rejectUnauthorized = process.env.ALLOW_INSECURE_TLS !== 'true'; 
    
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
    client.subscribe('ics/v1/telemetry/#', { qos: 1 }, (err) => {
      if (!err) {
        console.log('[MqttService] Subscribed to topic "ics/v1/telemetry/#" successfully.');
      } else {
        console.error('[MqttService] Telemetry subscription failed:', err.message);
      }
    });
    if (process.env.ENABLE_LEGACY_MQTT === 'true') {
      client.subscribe('ics/telemetry/#', { qos: 1 });
    }

    client.subscribe('ics/v1/hardware/snapshot/#', (err) => {
      if (!err) {
        console.log('[MqttService] Subscribed to topic "ics/v1/hardware/snapshot/#" successfully.');
      } else {
        console.error('[MqttService] Snapshot subscription failed:', err.message);
      }
    });

    client.subscribe('ics/v1/acks/#', (err) => {
      if (!err) {
        console.log('[MqttService] Subscribed to topic "ics/v1/acks/#" successfully.');
      } else {
        console.error('[MqttService] ACK subscription failed:', err.message);
      }
    });
  });

  client.on('message', async (topic, message) => {
    try {
      let payload = JSON.parse(message.toString());
      
      // Decrypt E2E Payload if encrypted
      if (payload.encrypted_data) {
        payload = decryptPayload(payload);
      }

      // Handle Full Snapshot from Hardware Runtime Engine
      if (topic.startsWith('ics/v1/hardware/snapshot/')) {
        await applyHardwareSnapshot(payload);
        return;
      }

      // Handle Security Command ACKs
      if (topic.startsWith('ics/v1/acks/')) {
        const [, , , topicRuntimeId, topicCommandId] = topic.split('/');
        if (payload.command_type === 'policy' || payload.policy_apply_id) {
          await processPolicyAck(payload, {
            runtime_id: topicRuntimeId,
            command_id: topicCommandId,
          });
        } else {
          await processCommandAck(payload, {
            runtime_id: topicRuntimeId,
            command_id: topicCommandId,
          });
        }
        return;
      }
      
      // 1. Write to InfluxDB
      await writeTelemetry(payload);
 
      // 2. Check metrics for anomalies (Rule Engine)
      await checkTelemetryAnomalies(payload);

      // 2.5. Run AI Anomaly Classification (ML Model)
      await runAiClassification(payload);

      // 3. Process structured logs
      await processStructuredLogs(payload);

      // 4. Update dynamic risk score in real-time
      if (payload.device_id) {
        calculateAndUpdateRiskScore(payload.device_id).catch(() => {});
      }
    } catch (error) {
      // Ignore parsing errors for non-json
    }
  });

  client.on('error', (err) => {
    console.error('[MqttService] Connection error:', err.message);
  });
};

const encodeSecurePayload = (payload) => {
  const dataStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const iv = crypto.randomBytes(12);
  const aesSecret = process.env.AES_SECRET_KEY;
  if (!aesSecret || Buffer.byteLength(aesSecret) !== 32) {
    throw new Error('AES_SECRET_KEY must be exactly 32 bytes.');
  }
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(aesSecret), iv);
  let encrypted = cipher.update(dataStr, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return JSON.stringify({
    encrypted_data: encrypted,
    iv: iv.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64'),
    alg: 'AES-256-GCM'
  });
};

export const publishMqtt = (topic, payload) => {
  if (!mqttClient?.connected) {
    console.error('[MqttService] MQTT Client not connected, publish failed.');
    return false;
  }
  try {
    mqttClient.publish(topic, encodeSecurePayload(payload), { qos: 1 }, (error) => {
      if (error) {
        console.error(`[MqttService] Publish failed for ${topic}:`, error.message);
      }
    });
    return true;
  } catch (error) {
    console.error(`[MqttService] Failed to encode MQTT payload for ${topic}:`, error.message);
    return false;
  }
};

export const publishMqttAsync = (topic, payload, timeoutMs = 5000) => new Promise((resolve, reject) => {
  if (!mqttClient?.connected) {
    reject(new Error('MQTT broker is not connected.'));
    return;
  }

  let securePayload;
  try {
    securePayload = encodeSecurePayload(payload);
  } catch (error) {
    reject(error);
    return;
  }

  let settled = false;
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true;
      reject(new Error(`MQTT PUBACK timeout for ${topic}.`));
    }
  }, timeoutMs);
  timer.unref?.();

  mqttClient.publish(topic, securePayload, { qos: 1 }, (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) {
      reject(error);
    } else {
      resolve(true);
    }
  });
});

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

      // 4. Run automated playbooks for this rule
      await executePlaybook(rule.rule_name, device_id, { alert_id: alert._id });
    }
  }
};

const runAiClassification = async (payload) => {
  const { device_id, zone, metrics } = payload;
  if (!device_id || !metrics) return;

  try {
    const aiUrl = process.env.AI_ENGINE_URL || 'http://localhost:5000';
    // Native fetch (Node 18+)
    const response = await fetch(`${aiUrl}/classify/anomaly`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics })
    });
    
    if (response.ok) {
      const data = await response.json();
      // data: { label: "DDoS", confidence: 0.95 }
      if (data.label && data.label !== 'Normal' && data.label !== '0' && data.confidence > 0.8) {
        const rule_name = `AI_DETECTED_${data.label.toUpperCase().replace(/\s+/g, '_')}`;
        
        const recentAlert = await Alert.findOne({
          device_id, rule_name, status: 'new',
          detected_at: { $gt: new Date(Date.now() - 5 * 60 * 1000) }
        });
        
        if (!recentAlert) {
          console.log(`🤖 [AI Classification] Detected ${data.label} on ${device_id} (Confidence: ${data.confidence})`);
          
          const alert = await Alert.create({
            rule_name,
            device_id,
            title: `AI Cảnh báo: Mô hình ML phát hiện ${data.label}`,
            description: `Mô hình phát hiện bất thường với độ tin cậy ${data.confidence * 100}% dựa trên metrics: CPU ${metrics.cpu_usage}%, Mem ${metrics.memory_usage}%`,
             severity: 'CRITICAL',
             status: 'new',
             detected_at: new Date(),
             ai_provenance: {
               model_id: data.model_id || null,
               algorithm: data.algorithm || null,
               feature_schema_version: data.feature_schema_version || null,
               score: data.score ?? null,
               confidence: data.confidence ?? null,
               inference_at: new Date(),
             },
          });

          const incident = await Incident.create({
            title: `Sự cố AI: ${data.label} trên ${device_id}`,
            description: `Hệ thống AI/ML đã phát hiện luồng dữ liệu bất thường phân loại là [${data.label}]. Độ tin cậy: ${data.confidence}.`,
            severity: 'CRITICAL',
            status: 'investigating',
            alert_ids: [alert._id]
          });

          alert.incident_id = incident._id;
          await alert.save();

          await IncidentTimeline.create({
            incident_id: incident._id,
            actor: 'AI Anomaly Detector',
            action_type: 'incident_created',
            description: `AI phát hiện dị thường ${data.label} (Conf: ${data.confidence})`,
            metadata: {
              metrics,
              label: data.label,
              confidence: data.confidence,
              model_id: data.model_id,
              algorithm: data.algorithm,
              feature_schema_version: data.feature_schema_version,
              score: data.score,
              inference_at: new Date().toISOString(),
            }
          });

          socketService.emitNewAlert(alert);
          socketService.emitNewIncident(incident);

          // 4. Run automated playbooks for AI anomaly
          await executePlaybook(rule_name, device_id, { alert_id: alert._id });
        }
      }
    }
  } catch (err) {
    // Silent fail if AI engine is down
  }
};

const processStructuredLogs = async (payload) => {
  const { device_id, zone, logs } = payload;
  if (!device_id || !logs || !Array.isArray(logs) || logs.length === 0) return;

  for (const log of logs) {
    const { event, log_level, source_ip, message } = log;
    
    // Write physical operational log to InfluxDB
    writeDeviceEvent({
      device_id,
      zone: zone || 'Default-Zone',
      log_type: 'operational',
      event: event || 'LOG',
      severity: log_level || 'INFO',
      source_ip,
      message: message || `${event || 'Log'} event on ${device_id}`,
      timestamp: new Date()
    }).catch(err => console.error('[MqttService] Failed to write event to InfluxDB:', err.message));
    
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

      // 4. Run automated playbooks for structured log anomaly
      await executePlaybook(rule_name, device_id, { alert_id: alert._id });
    }
  }
};

export default {
  connectMqtt,
  publishMqtt,
  publishMqttAsync
};
