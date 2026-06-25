import mqtt from 'mqtt';
import { writeTelemetry } from './influxService.js';
import { Alert, Incident, IncidentTimeline } from '../models/index.js';
import { sendEmailAlert } from './emailService.js';
import { sendTelegramAlert } from './telegramService.js';

const MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';

export const connectMqtt = () => {
  console.log(`[MqttService] Connecting to MQTT Broker at: ${MQTT_URL}...`);
  const client = mqtt.connect(MQTT_URL);

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

export default {
  connectMqtt
};
