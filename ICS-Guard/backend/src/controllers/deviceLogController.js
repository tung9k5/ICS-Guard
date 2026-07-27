import { Device, Alert } from '../models/index.js';
import influxService from '../services/influxService.js';

/**
 * GET /api/audits/device-logs
 * Fetch physical infrastructure logs from InfluxDB
 */
export const getDeviceLogs = async (req, res) => {
  const { device_id, severity, limit } = req.query;
  const parsedLimit = parseInt(limit, 10) || 100;

  try {
    const logs = await influxService.queryDeviceEvents(device_id || null, severity || null, parsedLimit);
    return res.status(200).json(logs);
  } catch (err) {
    console.error('[DeviceLogController] Error getting device logs:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};

/**
 * GET /api/audits/device-averages
 * Fetch average performance statistics and device status summary
 */
export const getDeviceAverages = async (req, res) => {
  const { device_id } = req.query;

  try {
    if (device_id) {
      // 1. Specific Device mode
      const [influxAverages, device, alertCount] = await Promise.all([
        influxService.queryDeviceAverages(device_id, 7),
        Device.findById(device_id),
        Alert.countDocuments({ device_id, status: 'new' })
      ]);

      if (!device) {
        return res.status(404).json({ error: 'Not Found', message: 'Device not found.' });
      }

      return res.status(200).json({
        device_id,
        name: device.name,
        status: device.status,
        risk_score: device.risk_score || 0,
        active_alerts: alertCount,
        avg_cpu: influxAverages.avg_cpu || 0,
        avg_temp: influxAverages.avg_temp || 0,
        avg_bandwidth: influxAverages.avg_bandwidth || 0
      });
    } else {
      // 2. System-wide Overview mode
      const [influxAverages, devices, totalAlerts] = await Promise.all([
        influxService.queryDeviceAverages(null, 7),
        Device.find({}),
        Alert.countDocuments({ status: 'new' })
      ]);

      // Calculate status counts
      let active = 0;
      let isolated = 0;
      let alert = 0;
      let offline = 0;

      devices.forEach(d => {
        const status = (d.status || '').toLowerCase();
        if (status === 'active' || status === 'online') {
          active++;
        } else if (status === 'isolated') {
          isolated++;
        } else if (status === 'quarantined' || status === 'inactive') {
          alert++;
        } else if (status === 'offline') {
          offline++;
        } else {
          active++; // Default fallback
        }
      });

      // Calculate system average risk score
      const avgRiskScore = devices.length
        ? Math.round(devices.reduce((acc, d) => acc + (d.risk_score || 0), 0) / devices.length)
        : 0;

      return res.status(200).json({
        risk_score: avgRiskScore,
        active_alerts: totalAlerts,
        avg_cpu: influxAverages.avg_cpu || 0,
        avg_temp: influxAverages.avg_temp || 0,
        avg_bandwidth: influxAverages.avg_bandwidth || 0,
        status_stats: {
          active,
          isolated,
          alert,
          offline
        }
      });
    }
  } catch (err) {
    console.error('[DeviceLogController] Error getting device averages:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
};
