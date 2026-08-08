import { Device, Alert } from '../models/index.js';
import cveService from './cveService.js';
import socketService from './socketService.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5000';

/**
 * Tính toán và cập nhật điểm rủi ro cho một thiết bị
 * @param {string} deviceId ID của thiết bị cần tính toán
 * @returns {Promise<number>} Điểm rủi ro mới (0 -> 100)
 */
export const calculateAndUpdateRiskScore = async (deviceId) => {
  try {
    // 1. Lấy thông tin thiết bị từ MongoDB
    const device = await Device.findById(deviceId);
    if (!device) {
      console.warn(`[RiskService] Device not found for ID: ${deviceId}`);
      return 0;
    }

    // 2. Lấy danh sách CVE tiềm ẩn từ cveService
    const keyword = device.hardware_model || device.hardwareModel || device.node_type || device.type || 'PLC';
    const cvesRaw = await cveService.fetchDeviceCves(keyword);

    // Chuẩn hóa danh sách CVE theo Pydantic schema
    const formattedCves = cvesRaw.map(c => {
      let sev = (c.severity || 'MEDIUM').toUpperCase();
      if (!['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sev)) sev = 'MEDIUM';

      return {
        device_id: deviceId,
        cve_id: c.cve_id,
        cvss_score: Number(c.cvss || c.cvss_score || 0),
        description: c.description || '',
        severity: sev,
        status: 'vulnerable',
        detected_at: new Date().toISOString()
      };
    });

    // 3. Lấy tất cả Alerts chưa xử lý của thiết bị
    const alertsRaw = await Alert.find({
      device_id: deviceId,
      status: { $in: ['new', 'acknowledged'] }
    });

    // Chuẩn hóa danh sách Alerts theo Pydantic schema
    const formattedAlerts = alertsRaw.map(a => {
      let sev = (a.severity || 'MEDIUM').toUpperCase();
      if (!['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(sev)) sev = 'MEDIUM';

      let status = (a.status || 'new').toLowerCase();
      if (!['new', 'acknowledged', 'resolved', 'false_positive'].includes(status)) status = 'new';

      return {
        _id: a._id.toString(),
        rule_name: a.rule_name || 'UNKNOWN',
        device_id: deviceId,
        title: a.title || 'Alert',
        description: a.description || '',
        severity: sev,
        status: status,
        source_ip: a.source_ip || null,
        destination_ip: a.destination_ip || null,
        event_count: Number(a.event_count || 1),
        raw_events_sample: (a.raw_events_sample || []).map(ev => ({
          timestamp: ev.timestamp || new Date().toISOString(),
          message: ev.message || ''
        })),
        detected_at: (a.detected_at || a.createdAt || new Date()).toISOString(),
        incident_id: a.incident_id ? a.incident_id.toString() : null
      };
    });

    // 4. Chuẩn hóa Device theo Pydantic schema
    let devType = (device.type || device.node_type || 'sensor').toLowerCase();
    if (!['plc', 'smart_meter', 'sensor', 'camera'].includes(devType)) {
      devType = 'sensor';
    }

    let devStatus = (device.status || 'offline').toLowerCase();
    if (devStatus === 'isolated') devStatus = 'quarantined';
    if (devStatus === 'active') devStatus = 'online';
    if (!['online', 'offline', 'quarantined'].includes(devStatus)) {
      devStatus = 'offline';
    }

    const formattedDevice = {
      _id: device._id,
      name: device.name,
      type: devType,
      zone: device.zone || 'Zone-A',
      ip_address: device.ip_address || device.ipAddress || '0.0.0.0',
      mac_address: device.mac_address || device.macAddress || '00:00:00:00:00:00',
      status: devStatus,
      risk_score: Number(device.risk_score || 0),
      api_key: device.api_key || 'mock_key_123',
      baseline_metrics: {
        bytes_per_second_max: Number(device.baseline_metrics?.bytes_per_second_max || 25000),
        connection_rate_max: Number(device.baseline_metrics?.connection_rate_max || 20)
      },
      firmware_version: device.firmware_version || '1.0.0',
      hardware_model: device.hardware_model || 'Standard',
      created_at: (device.createdAt || new Date()).toISOString(),
      updated_at: (device.updatedAt || new Date()).toISOString()
    };

    // 5. Gửi POST sang AI-Engine để tính toán Risk Score
    const payload = {
      device: formattedDevice,
      cves: formattedCves,
      active_alerts: formattedAlerts
    };

    let newRiskScore = 0;
    let success = false;

    try {
      const response = await fetch(`${AI_ENGINE_URL}/calculate/risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        newRiskScore = Number(data.risk_score || 0);
        success = true;
      } else {
        console.error(`[RiskService] AI Engine returned status ${response.status} for risk calculation.`);
      }
    } catch (fetchErr) {
      console.warn(`[RiskService] AI Engine unreachable (${fetchErr.message}). Using local rule-based risk calculation fallback.`);
    }

    if (!success) {
      // Calculate local fallback risk score
      let baseScore = devStatus === 'online' ? 10 : (devStatus === 'quarantined' ? 50 : 5);
      const maxCveScore = formattedCves.length > 0 
        ? Math.max(...formattedCves.map(c => Number(c.cvss_score || 0))) 
        : 0;
      let alertPoints = 0;
      for (const alert of formattedAlerts) {
        const sev = (alert.severity || 'MEDIUM').toUpperCase();
        if (sev === 'CRITICAL') alertPoints += 30;
        else if (sev === 'HIGH') alertPoints += 20;
        else if (sev === 'MEDIUM') alertPoints += 10;
        else if (sev === 'LOW') alertPoints += 5;
      }
      newRiskScore = Math.min(100, Math.max(0, Math.round(baseScore + (maxCveScore * 3.5) + alertPoints)));
    }

    // 6. Cập nhật cơ sở dữ liệu MongoDB
    device.risk_score = newRiskScore;
    await device.save();

    console.log(`[RiskService] Updated Risk Score for ${deviceId} to: ${newRiskScore} (${success ? 'AI Engine' : 'Local Fallback'})`);

    // 7. Phát sự kiện WebSocket
    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_RISK_UPDATED', { device_id: deviceId, risk_score: newRiskScore });
      // Emit general device sync update
      io.emit('DEVICE_SYNC', { action: 'update', device });
    }

    return newRiskScore;
  } catch (error) {
    console.error(`[RiskService] Error calculating risk score for device ${deviceId}:`, error.message);
    return 0;
  }
};

export default {
  calculateAndUpdateRiskScore
};

// ===========================================================
// AGING SCORE & MAINTENANCE/REPLACEMENT ADVISORY
// ===========================================================

/**
 * Kiểm tra tuổi đời thiết bị (aging_score = số năm từ commissioned_date).
 * - Mỗi lần aging_score tăng → gửi cảnh báo BẢO DƯỠNG
 * - Khi aging_score >= 15 → gửi cảnh báo THAY THẾ THIẾT BỊ
 * Thực thi hàng ngày qua cron job.
 */
export const checkAndUpdateAgingAdvisory = async () => {
  try {
    const devices = await Device.find({
      approval_status: 'approved',
      status: { $ne: 'decommissioned' },
      commissioned_date: { $ne: null }
    });

    const now = new Date();

    for (const device of devices) {
      const commissDate = new Date(device.commissioned_date);
      const ageInYears = (now - commissDate) / (1000 * 60 * 60 * 24 * 365.25);
      const newAgingScore = Math.floor(ageInYears);

      if (newAgingScore > (device.aging_score || 0)) {
        // Aging score increased — send maintenance advisory
        device.aging_score = newAgingScore;

        const thisYear = now.getFullYear();
        const alreadySentThisYear = device.last_advisory_sent_year === thisYear;

        if (!alreadySentThisYear) {
          if (newAgingScore >= 15) {
            device.maintenance_advisory = 'replacement';
            device.last_advisory_sent_year = thisYear;

            // Notify via Telegram
            try {
              const { sendTelegramAlert } = await import('./telegramService.js');
              await sendTelegramAlert(
                `[CẢNH BÁO THAY THẾ THIẾT BỊ]\n\n` +
                `Thiết bị *${device.name}* (ID: ${device._id}, IP: ${device.ipAddress})\n` +
                `Tuổi đời: *${newAgingScore} năm* ≥ 15 năm\n` +
                `Đề xuất: Lên kế hoạch THAY MỚI thiết bị này ngay.`
              );
            } catch (e) { console.warn('[AgingAdvisory] Telegram error:', e.message); }

            // Emit to dashboard for device_management role
            try {
              const io = socketService.getIo();
              if (io) {
                io.emit('DEVICE_ADVISORY', {
                  device_id: device._id,
                  device_name: device.name,
                  aging_score: newAgingScore,
                  advisory_type: 'replacement',
                  message: `Thiết bị ${device.name} đã hoạt động ${newAgingScore} năm. Cần thay mới!`
                });
              }
            } catch (e) { }

          } else {
            device.maintenance_advisory = 'maintenance';
            device.last_advisory_sent_year = thisYear;

            try {
              const { sendTelegramAlert } = await import('./telegramService.js');
              await sendTelegramAlert(
                `[NHẮC NHỞ BẢO DƯỠNG THIẾT BỊ]\n\n` +
                `Thiết bị *${device.name}* (ID: ${device._id}, IP: ${device.ipAddress})\n` +
                `Tuổi đời: *${newAgingScore} năm*\n` +
                `Đề xuất: Thực hiện kiểm tra và bảo dưỡng định kỳ.`
              );
            } catch (e) { console.warn('[AgingAdvisory] Telegram error:', e.message); }

            try {
              const io = socketService.getIo();
              if (io) {
                io.emit('DEVICE_ADVISORY', {
                  device_id: device._id,
                  device_name: device.name,
                  aging_score: newAgingScore,
                  advisory_type: 'maintenance',
                  message: `Thiết bị ${device.name} đã hoạt động ${newAgingScore} năm. Cần bảo dưỡng.`
                });
              }
            } catch (e) { }
          }

          await device.save();
        } else {
          await device.save();
        }
      }
    }

    console.log(`[AgingAdvisory] Checked ${devices.length} devices for aging advisories.`);
  } catch (err) {
    console.error('[AgingAdvisory] Error:', err.message);
  }
};

// ===========================================================
// 48H DECAY JOB — Giảm dần risk_score theo thời gian nếu không có incident mới
// Chạy mỗi 48h qua cron job trong app.js
// ===========================================================

/**
 * Giảm 1 điểm risk_score cho các thiết bị không có incident trong 48h.
 * Sau khi khắc phục sự cố, risk_score giảm ngay 15-30pt, sau đó decay dần.
 */
export const decayRiskScores = async () => {
  try {
    const approvedDevices = await Device.find({
      approval_status: 'approved',
      status: { $ne: 'decommissioned' },
      risk_score: { $gt: 0 }
    });

    let updated = 0;
    for (const device of approvedDevices) {
      const currentScore = device.risk_score || 0;
      const decayed = Math.max(0, currentScore - 1); // decay 1 point
      if (decayed !== currentScore) {
        device.risk_score = decayed;
        await device.save();

        // Notify dashboard
        const io = socketService.getIo();
        if (io) {
          io.emit('DEVICE_RISK_UPDATED', { device_id: device._id, risk_score: decayed });
        }
        updated++;
      }
    }
    console.log(`[RiskDecay] Decayed risk scores for ${updated} devices.`);
  } catch (err) {
    console.error('[RiskDecay] Error:', err.message);
  }
};

/**
 * Immediate resolution drop: giảm điểm ngay khi admin khôi phục xong một incident.
 * - CRITICAL: -15pt (85pt)
 * - HIGH: -20pt (80pt)
 * - MEDIUM: -25pt (75pt)
 * - LOW: -30pt (70pt)
 * @param {string} deviceId
 * @param {string|number} dropOrSeverity - Severity string hoặc điểm giảm (15-30)
 */
export const applyResolutionDrop = async (deviceId, dropOrSeverity = 'HIGH') => {
  try {
    const device = await Device.findById(deviceId);
    if (!device) return;

    let drop = 20;
    if (typeof dropOrSeverity === 'string') {
      const sev = dropOrSeverity.toUpperCase();
      if (sev === 'CRITICAL') drop = 15;
      else if (sev === 'HIGH') drop = 20;
      else if (sev === 'MEDIUM') drop = 25;
      else if (sev === 'LOW') drop = 30;
      else drop = 20;
    } else if (typeof dropOrSeverity === 'number') {
      drop = Math.max(15, Math.min(30, dropOrSeverity));
    }

    const currentScore = Number(device.risk_score || 100);
    const newScore = Math.max(0, currentScore - drop);
    device.risk_score = newScore;
    await device.save();

    const io = socketService.getIo();
    if (io) {
      io.emit('DEVICE_RISK_UPDATED', { device_id: deviceId, risk_score: newScore, reason: 'resolution_drop' });
      io.emit('DEVICE_SYNC', { action: 'update', device });
    }

    console.log(`[RiskService] Resolution drop applied for ${deviceId}: ${currentScore} -> ${newScore} (-${drop}pts for severity ${dropOrSeverity})`);
    return newScore;
  } catch (err) {
    console.error('[RiskService] applyResolutionDrop error:', err.message);
  }
};

