import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeTelemetry } from './influxService.js';
import { Alert, Incident, IncidentTimeline } from '../models/index.js';
import { sendEmailAlert } from './emailService.js';
import { sendTelegramAlert } from './telegramService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

let mqttClient = null;

export const connectMqtt = () => {
  const options = {};
  
  // Setup TLS configuration if ca.crt exists
  const caCertPath = path.resolve(__dirname, '../certs/ca.crt');
  if (fs.existsSync(caCertPath)) {
    console.log(`[MqttService] Found CA Certificate at: ${caCertPath}. Configuring TLS...`);
    try {
      options.ca = fs.readFileSync(caCertPath);
      options.rejectUnauthorized = false; // Allow self-signed certificate hostname mismatches
      
      // Update protocol and port for TLS
      if (MQTT_URL.startsWith('mqtt://')) {
        MQTT_URL = MQTT_URL.replace('mqtt://', 'mqtts://').replace(':1883', ':8883');
      }
    } catch (err) {
      console.error('[MqttService] Failed to load CA certificate:', err.message);
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
      const payload = JSON.parse(message.toString());
      
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
    mqttClient.publish(topic, typeof payload === 'string' ? payload : JSON.stringify(payload), { qos: 1 });
    console.log(`[MqttService] Published to ${topic}:`, payload);
    return true;
  }
  console.error('[MqttService] MQTT Client not connected, publish failed.');
  return false;
};

const checkTelemetryAnomalies = async (payload) => {
  const { device_id, zone, metrics } = payload;
  if (!device_id || !metrics) return;

  const { bytes_per_second, temperature } = metrics;
  const now = Date.now();

  // A. Check Traffic Spike (bytes_per_second > 50000)
  if (bytes_per_second && bytes_per_second > 50000) {
    // Check if we raised this alert recently (within last 2 minutes) to prevent alert flooding
    const recentAlert = await Alert.findOne({
      device_id,
      rule_name: 'ABNORMAL_TRAFFIC_SPIKE',
      status: 'new',
      detected_at: { $gt: new Date(now - 2 * 60 * 1000) }
    });

    if (!recentAlert) {
      console.log(`⚠️ [Anomaly Detection] Traffic Spike detected on ${device_id}: ${bytes_per_second} Bps`);
      
      const alert = await Alert.create({
        rule_name: 'ABNORMAL_TRAFFIC_SPIKE',
        device_id,
        title: `Lưu lượng tăng đột biến trên ${device_id}`,
        description: `Lưu lượng mạng vọt lên ${bytes_per_second} Bps (vượt ngưỡng cho phép 50,000 Bps).`,
        severity: 'HIGH',
        status: 'new',
        detected_at: new Date()
      });

      const incident = await Incident.create({
        title: `Sự cố: Lưu lượng mạng tăng đột biến trên ${device_id}`,
        description: `Hệ thống phát hiện thiết bị ${device_id} tại vùng ${zone || 'unknown'} gửi nhận dữ liệu với băng thông bất thường (${bytes_per_second} Bps). Nghi ngờ tấn công DDoS hoặc rò rỉ dữ liệu.`,
        severity: 'HIGH',
        status: 'investigating',
        alert_ids: [alert._id]
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: 'Rule Engine Ingest',
        action_type: 'incident_created',
        description: `Phát hiện lưu lượng bất thường: ${bytes_per_second} Bps. Tự động cảnh báo và tạo sự cố.`,
        metadata: { bytes_per_second }
      });

      // Telegram & Email Notifications
      const alertText = `🚨 *SECURITY ALERT: TRAFFIC SPIKE*\n\nDevice: *${device_id}*\nZone: *${zone || 'unknown'}*\nTraffic: *${bytes_per_second.toLocaleString()} Bps*\nSeverity: *HIGH*`;
      await sendTelegramAlert(alertText);
      await sendEmailAlert({
        subject: `[ICS-GUARD ALERT] Traffic Spike on ${device_id}`,
        text: `Security Alert: Device ${device_id} in ${zone} is transmitting abnormally high traffic (${bytes_per_second} Bps).`,
        html: `<p><strong>Security Alert:</strong> Device <strong>${device_id}</strong> in <strong>${zone}</strong> is transmitting abnormally high traffic (<code>${bytes_per_second.toLocaleString()} Bps</code>).</p>
               <p>Recommended Action: Investigate device processes and rate limit network ports.</p>`
      });
    }
  }

  // B. Check Critical Temperature (temperature > 85.0)
  if (temperature && temperature > 85.0) {
    const recentAlert = await Alert.findOne({
      device_id,
      rule_name: 'CRITICAL_OVERHEAT',
      status: 'new',
      detected_at: { $gt: new Date(now - 2 * 60 * 1000) }
    });

    if (!recentAlert) {
      console.log(`⚠️ [Anomaly Detection] Critical overheat detected on ${device_id}: ${temperature} °C`);

      const alert = await Alert.create({
        rule_name: 'CRITICAL_OVERHEAT',
        device_id,
        title: `Nhiệt độ cực hạn trên thiết bị ${device_id}`,
        description: `Nhiệt độ thiết bị vọt lên ${temperature} °C (vượt ngưỡng an toàn 85.0 °C).`,
        severity: 'HIGH',
        status: 'new',
        detected_at: new Date()
      });

      const incident = await Incident.create({
        title: `Sự cố: Nhiệt độ quá hạn cực nghiêm trọng trên ${device_id}`,
        description: `Cảm biến ghi nhận nhiệt độ thiết bị ${device_id} tại vùng ${zone || 'unknown'} vượt ngưỡng an toàn nghiêm trọng (${temperature} °C). Nguy cơ cháy nổ vật lý hoặc phá hỏng thiết bị điều khiển.`,
        severity: 'HIGH',
        status: 'investigating',
        alert_ids: [alert._id]
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: 'Rule Engine Ingest',
        action_type: 'incident_created',
        description: `Phát hiện nhiệt độ bất thường: ${temperature} °C. Tự động cảnh báo và tạo sự cố.`,
        metadata: { temperature }
      });

      // Telegram & Email Notifications
      const alertText = `🚨 *SECURITY ALERT: CRITICAL OVERHEAT*\n\nDevice: *${device_id}*\nZone: *${zone || 'unknown'}*\nTemperature: *${temperature} °C*\nSeverity: *HIGH*`;
      await sendTelegramAlert(alertText);
      await sendEmailAlert({
        subject: `[ICS-GUARD ALERT] Overheat Alert on ${device_id}`,
        text: `Security Alert: Device ${device_id} in ${zone} is running at critically high temperature (${temperature} °C).`,
        html: `<p><strong>Security Alert:</strong> Device <strong>${device_id}</strong> in <strong>${zone}</strong> is running at critically high temperature (<code>${temperature} °C</code>).</p>
               <p>Recommended Action: Shutdown or isolate the physical device to prevent damage.</p>`
      });
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
