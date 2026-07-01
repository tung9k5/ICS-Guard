import mqtt from 'mqtt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeTelemetry } from './influxService.js';
import { Alert, Incident, IncidentTimeline, Device } from '../models/index.js';
import { sendEmailAlert } from './emailService.js';
import { sendTelegramAlert } from './telegramService.js';
import { getActiveAdminSessions, addEmergencyAlert } from './sessionRegistry.js';
import socketService from './socketService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

let client = null;

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
  client = mqtt.connect(MQTT_URL, options);

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
    } catch (error) {
      // Ignore parsing errors for non-json
    }
  });

  client.on('error', (err) => {
    console.error('[MqttService] Connection error:', err.message);
  });
};

export const publishMqtt = (topic, payload) => {
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(payload));
    console.log(`[MqttService] Published to ${topic}:`, payload);
    return true;
  }
  console.warn(`[MqttService] Cannot publish, client not connected.`);
  return false;
};

const checkTelemetryAnomalies = async (payload) => {
  const { device_id, zone, metrics } = payload;
  if (!device_id || !metrics) return;

  // Bypass checks if device is isolated/quarantined
  try {
    const device = await Device.findById(device_id);
    if (device && (device.status === 'isolated' || device.status === 'quarantined')) {
      return;
    }
  } catch (err) {
    console.error('[MqttService] Failed to check device status during anomaly check:', err);
  }

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

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        console.log(`[AlertRouter] Active Admins online: ${activeAdmins.join(', ')}. Suppressing email/Telegram, adding to Emergency Queue.`);
        addEmergencyAlert({
          device_id,
          attack_type: 'traffic_spike',
          message: `Đang có thiết bị [${device_id}] bị tấn công DDoS (Traffic Spike) và có người dùng Admin [${activeAdmins.join(', ')}] đang đăng nhập!`,
          admin_users: activeAdmins
        });
      } else {
        console.log('[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.');
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

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        console.log(`[AlertRouter] Active Admins online: ${activeAdmins.join(', ')}. Suppressing email/Telegram, adding to Emergency Queue.`);
        addEmergencyAlert({
          device_id,
          attack_type: 'overheat',
          message: `Đang có thiết bị [${device_id}] bị quá nhiệt (Critical Overheat) và có người dùng Admin [${activeAdmins.join(', ')}] đang đăng nhập!`,
          admin_users: activeAdmins
        });
      } else {
        console.log('[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.');
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
  }
};

export default {
  connectMqtt,
  publishMqtt
};
