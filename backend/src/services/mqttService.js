import mqtt from "mqtt";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { writeTelemetry } from "./influxService.js";
import { Alert, Incident, IncidentTimeline, Device } from "../models/index.js";
import { sendEmailAlert } from "./emailService.js";
import { sendTelegramAlert } from "./telegramService.js";
import {
  getActiveAdminSessions,
  addEmergencyAlert,
} from "./sessionRegistry.js";
import idGeneratorService from "./idGeneratorService.js";
import socketService from "./socketService.js";
import logger from "../utils/logger.js";
import {
  DEVICE_STATUSES,
  ALERT_STATUSES,
  INCIDENT_STATUSES,
  SEVERITY_LEVELS,
  INCIDENT_TIMELINE_TYPES,
  ATTACK_TYPES,
  THRESHOLDS,
  MQTT_TOPICS,
} from "../constants/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const anomalyThrottles = {};
const ANOMALY_THROTTLE_MS = 60000 * 5; // 5 minutes

let MQTT_URL = process.env.MQTT_URL;

let mqttClient = null;

// AES-256-CBC Config for E2E Encryption
const AES_SECRET_KEY = process.env.AES_SECRET_KEY;

function decryptPayload(encryptedData) {
  const separatorIdx = encryptedData.indexOf(":");
  if (separatorIdx === -1) throw new Error("Invalid encrypted payload format");
  const iv = Buffer.from(encryptedData.substring(0, separatorIdx), "base64");
  const ciphertext = encryptedData.substring(separatorIdx + 1);
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(AES_SECRET_KEY),
    iv,
  );
  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
}

export const connectMqtt = () => {
  const options = {};

  // Setup TLS configuration if ca.crt exists
  const caCertPath = path.resolve(__dirname, "../certs/ca.crt");
  if (fs.existsSync(caCertPath)) {
    logger.info(
      `[MqttService] Found CA Certificate at: ${caCertPath}. Configuring TLS...`,
    );
    try {
      options.ca = fs.readFileSync(caCertPath);
      options.rejectUnauthorized = false; // Allow self-signed certificate hostname mismatches

      // Update protocol and port for TLS
      const tlsPort = process.env.MQTT_TLS_PORT;
      if (MQTT_URL.startsWith("mqtt://")) {
        MQTT_URL = MQTT_URL.replace("mqtt://", "mqtts://").replace(
          /:\d+$/,
          `:${tlsPort}`,
        );
      }
    } catch (err) {
      logger.error("[MqttService] Failed to load CA certificate:", err.message);
    }
  }

  logger.info(`[MqttService] Connecting to MQTT Broker at: ${MQTT_URL}...`);
  const client = mqtt.connect(MQTT_URL, options);
  mqttClient = client;

  client.on("connect", () => {
    logger.info("[MqttService] Connected to MQTT Broker successfully.");
    client.subscribe(MQTT_TOPICS.TELEMETRY_WILDCARD, (err) => {
      if (!err) {
        logger.info(
          `[MqttService] Subscribed to topic "${MQTT_TOPICS.TELEMETRY_WILDCARD}" successfully.`,
        );
      } else {
        logger.error("[MqttService] Subscription failed:", err.message);
      }
    });
  });

  client.on("message", async (topic, message) => {
    try {
      let payload = JSON.parse(message.toString());

      // Decrypt E2E Payload if encrypted
      if (payload.encrypted_data) {
        payload = decryptPayload(payload.encrypted_data);
      }

      // 0. Auto-register device if not exists
      try {
        if (payload.device_id) {
          const device = await Device.findById(payload.device_id);
          if (!device) {
            await Device.create({
              _id: payload.device_id,
              name: `Simulator ${payload.device_id}`,
              type: payload.device_type || "IoT Device",
              status: DEVICE_STATUSES.ACTIVE,
              zone: payload.zone || "SimZone",
              description: "Auto-registered from simulator telemetry",
              ipAddress: "127.0.0.1",
              macAddress: "00:00:00:00:00:00",
            });
            logger.info(
              `[MqttService] Auto-registered new device: ${payload.device_id}`,
            );
          } else if (
            device.status !== DEVICE_STATUSES.ACTIVE &&
            device.status !== DEVICE_STATUSES.ISOLATED &&
            device.status !== DEVICE_STATUSES.QUARANTINED
          ) {
            device.status = DEVICE_STATUSES.ACTIVE;
            await device.save();
          }
        }
      } catch (err) {
        logger.error(
          "[MqttService] Error auto-registering device:",
          err.message,
        );
      }

      // 1. Write to InfluxDB
      await writeTelemetry(payload);

      // 2. Check metrics for anomalies
      await checkTelemetryAnomalies(payload);

      // 3. Process structured logs
      await processStructuredLogs(payload);
    } catch (error) {
      logger.error(
        "[MqttService] Error parsing/decrypting message:",
        error.message,
      );
    }
  });

  client.on("error", (err) => {
    logger.error("[MqttService] Connection error:", err.message);
  });
};

export const publishMqtt = (topic, payload) => {
  if (mqttClient && mqttClient.connected) {
    const dataStr =
      typeof payload === "string" ? payload : JSON.stringify(payload);

    // Encrypt E2E Payload with random IV per message
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      Buffer.from(AES_SECRET_KEY),
      iv,
    );
    let encrypted = cipher.update(dataStr, "utf8", "base64");
    encrypted += cipher.final("base64");

    // Prepend IV (base64) before ciphertext, separated by ':'
    const encryptedData = `${iv.toString("base64")}:${encrypted}`;
    const securePayload = JSON.stringify({ encrypted_data: encryptedData });

    mqttClient.publish(topic, securePayload, { qos: 1 });
    logger.info(`[MqttService] Published securely to ${topic}`);
    return true;
  }
  logger.error("[MqttService] MQTT Client not connected, publish failed.");
  return false;
};

const checkTelemetryAnomalies = async (payload) => {
  const { device_id, zone, metrics } = payload;
  if (!device_id || !metrics) return;

  let deviceSeverity = SEVERITY_LEVELS.HIGH;
  let deviceUserId = null;
  try {
    const device = await Device.findById(device_id);
    if (device) {
      deviceUserId = device.userId;
      if (device.status === DEVICE_STATUSES.ISOLATED || device.status === DEVICE_STATUSES.QUARANTINED) {
        return;
      }
      if (device.current_scenario !== 'NORMAL' && device.current_severity) {
        deviceSeverity = device.current_severity;
      }
    }
  } catch (err) {
    logger.error(
      "[MqttService] Failed to check device status during anomaly check:",
      err,
    );
  }

  const { bytes_per_second, temperature, smoke, water_level } = metrics;
  const now = Date.now();

  const isThrottled = (devId, rule) => {
    const key = `${devId}_${rule}`;
    if (anomalyThrottles[key] && (now - anomalyThrottles[key] < ANOMALY_THROTTLE_MS)) return true;
    anomalyThrottles[key] = now;
    return false;
  };

  // A. Check Traffic Spike
  if (bytes_per_second && bytes_per_second > THRESHOLDS.TRAFFIC_SPIKE_BPS) {
    if (!isThrottled(device_id, "ABNORMAL_TRAFFIC_SPIKE")) {
      logger.warn(
        `[Anomaly Detection] Traffic Spike detected on ${device_id}: ${bytes_per_second} Bps`,
      );

      const alert_code = await idGeneratorService.generate("alerts");
      const alert = await Alert.create({
        alert_code,
        rule_name: "ABNORMAL_TRAFFIC_SPIKE",
        device_id,
        title: `Lưu lượng tăng đột biến trên ${device_id}`,
        description: `Lưu lượng mạng lên ${Math.round(bytes_per_second).toLocaleString()} Bps (vượt ngưỡng cho phép ${THRESHOLDS.TRAFFIC_SPIKE_BPS.toLocaleString()} Bps).`,
        severity: deviceSeverity,
        status: ALERT_STATUSES.NEW,
        detected_at: new Date(),
      });

      const incident_code = await idGeneratorService.generate("incidents");
      const incident = await Incident.create({
        incident_code,
        title: `Sự cố: Lưu lượng mạng tăng đột biến trên ${device_id}`,
        description: `Hệ thống phát hiện thiết bị ${device_id} tại vùng ${zone || "unknown"} gửi nhận dữ liệu với băng thông bất thường (${bytes_per_second} Bps). Nghi ngờ tấn công DDoS hoặc rò rỉ dữ liệu.`,
        severity: deviceSeverity,
        status: INCIDENT_STATUSES.INVESTIGATING,
        alert_ids: [alert._id],
        assigned_to: deviceUserId || null,
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: "Rule Engine Ingest",
        action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
        description: `Phát hiện lưu lượng bất thường: ${bytes_per_second} Bps. Tự động cảnh báo và tạo sự cố.`,
        metadata: { bytes_per_second },
      });

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        logger.info(
          `[AlertRouter] Active Admins online: ${activeAdmins.join(", ")}. Suppressing email/Telegram, adding to Emergency Queue.`,
        );
        addEmergencyAlert({
          device_id,
          attack_type: ATTACK_TYPES.TRAFFIC_SPIKE,
          message: `Đang có thiết bị [${device_id}] bị tấn công DDoS (Traffic Spike) và có người dùng Admin [${activeAdmins.join(", ")}] đang đăng nhập!`,
          admin_users: activeAdmins,
        });
      } else {
        logger.info(
          "[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.",
        );
        const alertText = `🚨 *SECURITY ALERT: TRAFFIC SPIKE*\n\nDevice: *${device_id}*\nZone: *${zone || "unknown"}*\nTraffic: *${bytes_per_second.toLocaleString()} Bps*\nSeverity: *HIGH*`;
        await sendTelegramAlert(alertText);
        await sendEmailAlert({
          subject: `[ICS-GUARD ALERT] Traffic Spike on ${device_id}`,
          text: `Security Alert: Device ${device_id} in ${zone} is transmitting abnormally high traffic (${bytes_per_second} Bps).`,
          html: `<p><strong>Security Alert:</strong> Device <strong>${device_id}</strong> in <strong>${zone}</strong> is transmitting abnormally high traffic (<code>${bytes_per_second.toLocaleString()} Bps</code>).</p>
                 <p>Recommended Action: Investigate device processes and rate limit network ports.</p>`,
        });
      }
    }
  }

  // B. Check Critical Temperature
  if (temperature && temperature > THRESHOLDS.CRITICAL_TEMPERATURE_C) {
    if (!isThrottled(device_id, "CRITICAL_OVERHEAT")) {
      logger.warn(
        `[Anomaly Detection] Critical overheat detected on ${device_id}: ${temperature} °C`,
      );

      const alert_code = await idGeneratorService.generate("alerts");
      const alert = await Alert.create({
        alert_code,
        rule_name: "CRITICAL_OVERHEAT",
        device_id,
        title: `Nhiệt độ cực hạn trên thiết bị ${device_id}`,
        description: `Nhiệt độ thiết bị vọt lên ${temperature} °C (vượt ngưỡng an toàn ${THRESHOLDS.CRITICAL_TEMPERATURE_C} °C).`,
        severity: deviceSeverity,
        status: ALERT_STATUSES.NEW,
        detected_at: new Date(),
      });

      const incident_code = await idGeneratorService.generate("incidents");
      const incident = await Incident.create({
        incident_code,
        title: `Sự cố: Nhiệt độ quá hạn cực nghiêm trọng trên ${device_id}`,
        description: `Cảm biến ghi nhận nhiệt độ thiết bị ${device_id} tại vùng ${zone || "unknown"} vượt ngưỡng an toàn nghiêm trọng (${temperature} °C). Nguy cơ cháy nổ vật lý hoặc phá hỏng thiết bị điều khiển.`,
        severity: deviceSeverity,
        status: INCIDENT_STATUSES.INVESTIGATING,
        alert_ids: [alert._id],
        assigned_to: deviceUserId || null,
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: "Rule Engine Ingest",
        action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
        description: `Phát hiện nhiệt độ bất thường: ${temperature} °C. Tự động cảnh báo và tạo sự cố.`,
        metadata: { temperature },
      });

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        logger.info(
          `[AlertRouter] Active Admins online: ${activeAdmins.join(", ")}. Suppressing email/Telegram, adding to Emergency Queue.`,
        );
        addEmergencyAlert({
          device_id,
          attack_type: ATTACK_TYPES.OVERHEAT,
          message: `Đang có thiết bị [${device_id}] bị quá nhiệt (Critical Overheat) và có người dùng Admin [${activeAdmins.join(", ")}] đang đăng nhập!`,
          admin_users: activeAdmins,
        });
      } else {
        logger.info(
          "[AlertRouter] No active Admins online. Sending notifications via Email and Telegram.",
        );
        const alertText = `*SECURITY ALERT: CRITICAL OVERHEAT*\n\nDevice: *${device_id}*\nZone: *${zone || "unknown"}*\nTemperature: *${temperature} °C*\nSeverity: *HIGH*`;
        await sendTelegramAlert(alertText);
        await sendEmailAlert({
          subject: `[ICS-GUARD ALERT] Overheat Alert on ${device_id}`,
          text: `Security Alert: Device ${device_id} in ${zone} is running at critically high temperature (${temperature} °C).`,
          html: `<p><strong>Security Alert:</strong> Device <strong>${device_id}</strong> in <strong>${zone}</strong> is running at critically high temperature (<code>${temperature} °C</code>).</p>
                 <p>Recommended Action: Shutdown or isolate the physical device to prevent damage.</p>`,
        });
      }
    }
  }

  // C. Check Fire (Smoke)
  if (smoke && smoke > 400) {
    if (!isThrottled(device_id, "FIRE_ALARM")) {
      logger.warn(
        `[Anomaly Detection] Fire (Smoke) detected on ${device_id}: ${smoke} ppm`,
      );

      const alert_code = await idGeneratorService.generate("alerts");
      const alert = await Alert.create({
        alert_code,
        rule_name: "FIRE_ALARM",
        device_id,
        title: `Phát hiện khói/cháy nổ trên thiết bị ${device_id}`,
        description: `Nồng độ khói tăng vọt lên ${smoke} ppm (ngưỡng an toàn là 400). Nguy cơ hỏa hoạn.`,
        severity: deviceSeverity,
        status: ALERT_STATUSES.NEW,
        detected_at: new Date(),
      });

      const incident_code = await idGeneratorService.generate("incidents");
      const incident = await Incident.create({
        incident_code,
        title: `Sự cố: Nguy cơ hỏa hoạn tại khu vực ${zone || "unknown"} (Thiết bị ${device_id})`,
        description: `Cảm biến ghi nhận lượng khói dày đặc (${smoke} ppm). Cần kích hoạt hệ thống chữa cháy hoặc kiểm tra ngay lập tức để tránh cháy nổ vật lý.`,
        severity: deviceSeverity,
        status: INCIDENT_STATUSES.INVESTIGATING,
        alert_ids: [alert._id],
        assigned_to: deviceUserId || null,
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: "Rule Engine Ingest",
        action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
        description: `Phát hiện lượng khói bất thường: ${smoke} ppm. Tự động cảnh báo hỏa hoạn.`,
        metadata: { smoke },
      });

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        addEmergencyAlert({
          device_id,
          attack_type: "FIRE_ALARM",
          message: `CẢNH BÁO CHÁY: Thiết bị [${device_id}] phát hiện khói dày đặc! Có người dùng Admin [${activeAdmins.join(", ")}] đang trực.`,
          admin_users: activeAdmins,
        });
      } else {
        const alertText = `🔥 *SECURITY ALERT: FIRE ALARM*\n\nDevice: *${device_id}*\nZone: *${zone || "unknown"}*\nSmoke: *${smoke} ppm*\nSeverity: *CRITICAL*`;
        await sendTelegramAlert(alertText);
      }
    }
  }

  // D. Check Flood (Water Level)
  if (water_level && water_level > 70) {
    if (!isThrottled(device_id, "FLOOD_WARNING")) {
      logger.warn(
        `[Anomaly Detection] Flood (Water Level) detected on ${device_id}: ${water_level}%`,
      );

      const alert_code = await idGeneratorService.generate("alerts");
      const alert = await Alert.create({
        alert_code,
        rule_name: "FLOOD_WARNING",
        device_id,
        title: `Phát hiện ngập lụt tại thiết bị ${device_id}`,
        description: `Mức nước dâng cao đến ${water_level}% (ngưỡng an toàn là 70%). Nguy cơ ngập nước, đoản mạch.`,
        severity: deviceSeverity,
        status: ALERT_STATUSES.NEW,
        detected_at: new Date(),
      });

      const incident_code = await idGeneratorService.generate("incidents");
      const incident = await Incident.create({
        incident_code,
        title: `Sự cố: Nguy cơ ngập lụt tại khu vực ${zone || "unknown"} (Thiết bị ${device_id})`,
        description: `Cảm biến nước ghi nhận mức tràn ngập đạt ${water_level}%. Nguy cơ chập điện và ngắt mạch vật lý toàn hệ thống khu vực.`,
        severity: deviceSeverity,
        status: INCIDENT_STATUSES.INVESTIGATING,
        alert_ids: [alert._id],
        assigned_to: deviceUserId || null,
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: "Rule Engine Ingest",
        action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
        description: `Phát hiện mực nước bất thường: ${water_level}%. Tự động cảnh báo ngập lụt.`,
        metadata: { water_level },
      });

      // Phát sự kiện WebSocket
      socketService.emitNewAlert(alert);
      socketService.emitNewIncident(incident);

      // Smart Alert Routing
      const activeAdmins = getActiveAdminSessions();
      if (activeAdmins.length > 0) {
        addEmergencyAlert({
          device_id,
          attack_type: "FLOOD_WARNING",
          message: `CẢNH BÁO NGẬP LỤT: Thiết bị [${device_id}] báo mực nước tràn! Có người dùng Admin [${activeAdmins.join(", ")}] đang trực.`,
          admin_users: activeAdmins,
        });
      } else {
        const alertText = `🌊 *SECURITY ALERT: FLOOD WARNING*\n\nDevice: *${device_id}*\nZone: *${zone || "unknown"}*\nWater Level: *${water_level}%*\nSeverity: *HIGH*`;
        await sendTelegramAlert(alertText);
      }
    }
  }
};

const processStructuredLogs = async (payload) => {
  const { device_id, zone, logs } = payload;
  if (!device_id || !logs || !Array.isArray(logs) || logs.length === 0) return;

  let deviceSeverityOverride = null;
  try {
    const device = await Device.findById(device_id);
    if (device && device.current_scenario !== 'NORMAL' && device.current_severity) {
      deviceSeverityOverride = device.current_severity;
    }
  } catch (err) {
    logger.error("[MqttService] Failed to fetch device for structured logs:", err);
  }

  for (const log of logs) {
    const { event, log_level, source_ip, message } = log;

    // Only raise security Alerts/Incidents for WARN, ERROR, CRITICAL logs
    if (log_level === "INFO") continue;

    // Map log event to Rule Name and Severity
    let rule_name = "";
    let severity = "MEDIUM";
    let alert_title = "";

    if (event === "OTA_HASH_MISMATCH") {
      rule_name = "MALICIOUS_OTA_UPDATE";
      severity = "CRITICAL";
      alert_title = `Tấn công nâng cấp Firmware độc hại trên ${device_id}`;
    } else if (event === "WATCHDOG_RESET") {
      rule_name = "DEVICE_CRASH_WDT";
      severity = "HIGH";
      alert_title = `Thiết bị sập do Watchdog Reset trên ${device_id}`;
    } else if (event === "SENSOR_SPOOFING_DETECTED") {
      rule_name = "SENSOR_DATA_SPOOFING";
      severity = "CRITICAL";
      alert_title = `Giả mạo dữ liệu cảm biến trên ${device_id}`;
    } else if (event === "MOTOR_CURRENT_OVERLOAD") {
      rule_name = "ACTUATOR_MOTOR_OVERLOAD";
      severity = "HIGH";
      alert_title = `Quá tải động cơ thiết bị chấp hành ${device_id}`;
    } else if (event === "UNAUTHORIZED_CMD") {
      rule_name = "UNAUTHORIZED_ACTUATOR_COMMAND";
      severity = "CRITICAL";
      alert_title = `Lệnh điều khiển trái phép trên ${device_id}`;
    } else if (
      event === "FIRMWARE_CHECKSUM_ERROR" ||
      event === "SCAN_CYCLE_LIMIT_EXCEEDED"
    ) {
      rule_name = "PLC_LOGIC_TAMPERING";
      severity = "CRITICAL";
      alert_title = `Thay đổi logic điều khiển PLC trên ${device_id}`;
    } else if (event === "ROUTE_MODIFIED") {
      rule_name = "GATEWAY_ROUTE_POISONING";
      severity = "CRITICAL";
      alert_title = `Đầu độc bảng định tuyến Gateway trên ${device_id}`;
    } else if (event === "TLS_HANDSHAKE_FAILED") {
      rule_name = "GATEWAY_WAN_DOS";
      severity = "HIGH";
      alert_title = `Tấn công Từ chối dịch vụ (DoS) trên Gateway ${device_id}`;
    } else {
      // General anomaly fallback
      rule_name = "GENERAL_ANOMALY";
      severity = log_level === "CRITICAL" ? "CRITICAL" : "HIGH";
      alert_title = `Phát hiện hành vi bất thường trên ${device_id}`;
    }

    if (deviceSeverityOverride) {
      severity = deviceSeverityOverride;
    }

    const now = Date.now();
    const isThrottled = (devId, rule) => {
      const key = `${devId}_${rule}`;
      if (anomalyThrottles[key] && (now - anomalyThrottles[key] < ANOMALY_THROTTLE_MS)) return true;
      anomalyThrottles[key] = now;
      return false;
    };

    if (!isThrottled(device_id, rule_name)) {
      logger.warn(
        `[Anomaly Log Detection] Raised ${rule_name} on ${device_id}: ${message}`,
      );

      const alert_code = await idGeneratorService.generate("alerts");
      const alert = await Alert.create({
        alert_code,
        rule_name,
        device_id,
        title: alert_title,
        description: message,
        severity,
        status: ALERT_STATUSES.NEW,
        source_ip: source_ip || "127.0.0.1",
        detected_at: new Date(),
      });

      const incident_code = await idGeneratorService.generate("incidents");
      const incident = await Incident.create({
        incident_code,
        title: `Sự cố: ${alert_title}`,
        description: `Hệ thống phát hiện nhật ký bảo mật nghiêm trọng gửi lên từ thiết bị ${device_id} tại vùng mạng ${zone || "unknown"}: "${message}".`,
        severity,
        status: INCIDENT_STATUSES.INVESTIGATING,
        alert_ids: [alert._id],
        assigned_to: deviceUserId || null,
      });

      alert.incident_id = incident._id;
      await alert.save();

      await IncidentTimeline.create({
        incident_id: incident._id,
        actor: "Security Log Engine",
        action_type: INCIDENT_TIMELINE_TYPES.INCIDENT_CREATED,
        description: `Phát hiện mã sự kiện ${event}. Log: "${message}".`,
        metadata: { event, log_level, source_ip },
      });

      // Telegram / Email alerts
      const alertText = `🚨 *CRITICAL SECURITY ALERT: ${rule_name}*\n\nDevice: *${device_id}*\nZone: *${zone || "unknown"}*\nEvent: *${event}*\nMessage: _${message}_\nSeverity: *${severity}*`;
      sendTelegramAlert(alertText).catch((err) =>
        logger.error("[MqttService] Telegram send error:", err),
      );
      sendEmailAlert({
        subject: `[ICS-GUARD CRITICAL] ${rule_name} on ${device_id}`,
        text: `Critical Alert: ${message} (Event: ${event})`,
        html: `<h3>Critical Security Alert</h3>
               <p><strong>Device:</strong> ${device_id}</p>
               <p><strong>Zone:</strong> ${zone || "unknown"}</p>
               <p><strong>Event:</strong> ${event}</p>
               <p><strong>Log Details:</strong> ${message}</p>
               <p><strong>Action Taken:</strong> Flagged in SOC Dashboard and registered for AI analysis.</p>`,
      }).catch((err) => logger.error("[MqttService] Email send error:", err));
    }
  }
};

export default {
  connectMqtt,
  publishMqtt,
};
