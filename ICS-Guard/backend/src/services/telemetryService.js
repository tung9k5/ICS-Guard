import alertRepository from '../repositories/alertRepository.js';
import incidentRepository from '../repositories/incidentRepository.js';
import incidentTimelineRepository from '../repositories/incidentTimelineRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import { sendTelegramAlert } from './telegramService.js';
import { publishMqtt } from './mqttService.js';
import socketService from './socketService.js';
import { writePoint } from './influxService.js';
import AppError from '../utils/AppError.js';

const INFLUX_MEASUREMENT = 'device_telemetry';

// Throttling tracking
const alertThrottles = {};
const THROTTLE_WINDOW_MS = 10000;

// Brute force tracking
const authFailedAttempts = {};
const BRUTE_FORCE_THRESHOLD = 5;
const BRUTE_FORCE_WINDOW_MS = 60000;

class TelemetryService {
  async ingestLog(data) {
    const { device_id, log_type, event, source_ip, username, timestamp } = data;
    const logTime = timestamp ? new Date(timestamp) : new Date();

    const device = await deviceRepository.findById(device_id);
    if (!device) {
      throw new AppError(`Device ${device_id} not found`, 404);
    }

    device.lastSeen = new Date();
    if (device.status !== 'isolated') {
      device.status = 'active';
    }
    await deviceRepository.updateById(device_id, { lastSeen: device.lastSeen, status: device.status });

    try {
      writePoint(INFLUX_MEASUREMENT, {
        tags: { device_id, log_type, source_ip: source_ip || 'unknown' },
        fields: { event, username: username || 'unknown' },
        timestamp: logTime
      });
    } catch (influxErr) {
      console.error('Error writing to InfluxDB:', influxErr);
    }

    if (log_type === 'auth_failed') {
      await this.handleAuthFailed(device_id, source_ip, username, event, logTime);
    }
    
    return { success: true };
  }

  async handleAuthFailed(device_id, source_ip, username, event, logTime) {
    const trackerKey = `${device_id}_${source_ip}`;
    if (!authFailedAttempts[trackerKey]) {
      authFailedAttempts[trackerKey] = [];
    }

    const now = Date.now();
    authFailedAttempts[trackerKey].push(now);
    authFailedAttempts[trackerKey] = authFailedAttempts[trackerKey].filter(time => now - time < BRUTE_FORCE_WINDOW_MS);

    if (authFailedAttempts[trackerKey].length >= BRUTE_FORCE_THRESHOLD) {
      const throttleKey = `brute_force_${trackerKey}`;
      if (alertThrottles[throttleKey] && (now - alertThrottles[throttleKey] < THROTTLE_WINDOW_MS)) {
        return;
      }
      alertThrottles[throttleKey] = now;

      const device = await deviceRepository.findById(device_id);
      const title = `Brute Force Attack Detected on ${device_id}`;
      const description = `Detected ${authFailedAttempts[trackerKey].length} failed login attempts from IP ${source_ip} to device ${device_id} within 60 seconds. Target username: ${username}`;
      
      const newAlert = await alertRepository.create({
        rule_name: 'BRUTE_FORCE_DETECTED',
        device_id,
        title,
        description,
        severity: 'CRITICAL',
        status: 'new',
        source_ip,
        event_count: authFailedAttempts[trackerKey].length,
        raw_events_sample: [{ timestamp: logTime, message: event }],
      });

      const newIncident = await incidentRepository.create({
        title: `Security Incident: ${title}`,
        description: `Generated from Critical Alert: ${description}`,
        severity: 'CRITICAL',
        status: 'open',
        alert_ids: [newAlert._id]
      });

      await incidentTimelineRepository.create({
        incident_id: newIncident._id,
        actor: 'system',
        action_type: 'auto_created',
        description: `Incident automatically created from Brute Force alert on device ${device_id}.`
      });

      await alertRepository.updateStatusById(newAlert._id, { incident_id: newIncident._id });
      authFailedAttempts[trackerKey] = [];

      try {
        await sendTelegramAlert(
          `🚨 *CRITICAL SECURITY INCIDENT*\n\n*Type:* Brute Force Attack\n*Device:* ${device ? device.name : device_id}\n*Source IP:* ${source_ip}\n*Target User:* ${username}\n*Incident ID:* ${newIncident._id}\n\nPlease review immediately in the ICS-Guard dashboard.`,
          [
            { text: "View Incident", url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/incidents/${newIncident._id}` },
            { text: `Isolate ${device_id}`, callback_data: `isolate_${device_id}` }
          ]
        );
      } catch (telegramErr) {
        console.error('Failed to send telegram alert for brute force:', telegramErr);
      }

      if (typeof socketService !== 'undefined') {
        socketService.emitNewIncident({
          id: newIncident._id,
          title: newIncident.title,
          severity: newIncident.severity
        });
      }
    }
  }

  async controlAttack(deviceId, attackType) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) throw new AppError(`Device ${deviceId} not found`, 404);

    publishMqtt('ics/control/attack', { device_id: deviceId, attack_type: attackType });

    if (attackType === 'stop' && device.status === 'isolated') {
      device.status = 'active';
      await deviceRepository.updateById(deviceId, { status: 'active' });
    } else if (attackType !== 'stop') {
      device.status = 'isolated';
      await deviceRepository.updateById(deviceId, { status: 'isolated' });
    }
    
    return { success: true, message: `Attack ${attackType} sent to ${deviceId}` };
  }

  async testTelegramConnection(chatId) {
    const testMessage = "✅ Bip bop! ICS-Guard Telegram Bot connection is successful. The system is ready to send critical alerts here.";
    try {
      await sendTelegramAlert(testMessage);
      return { success: true, message: 'Test message sent successfully' };
    } catch (error) {
      throw new AppError('Failed to send test message: ' + error.message, 500);
    }
  }
}

export default new TelemetryService();
