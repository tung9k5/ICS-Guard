import { Device, Incident } from '../models/index.js';
import { queryNetworkTrafficDashboard } from '../services/influxService.js';

export const getSystemHealth = async (req, res) => {
  try {
    const devices = await Device.find({}, 'status');
    
    let healthy = 0;
    let warning = 0;
    let critical = 0;

    devices.forEach(device => {
      switch (device.status) {
        case 'active':
        case 'online':
          healthy++;
          break;
        case 'inactive':
        case 'offline':
          warning++;
          break;
        case 'isolated':
        case 'quarantined':
          critical++;
          break;
        default:
          warning++; // Default fallback
      }
    });

    const data = [
      { key: 'healthy', value: healthy },
      { key: 'warning', value: warning },
      { key: 'critical', value: critical },
    ];

    return res.status(200).json(data);
  } catch (err) {
    console.error('getSystemHealth error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getThreatActivity = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const incidents = await Incident.find({
      createdAt: { $gte: sevenDaysAgo }
    }, 'severity createdAt');

    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const matrix = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        matrix.push({ dayIndex: d, day: daysMap[d], hour: h, count: 0 });
      }
    }

    incidents.forEach(incident => {
      const dt = new Date(incident.createdAt);
      const d = dt.getDay();
      const h = dt.getHours();
      const cell = matrix.find(m => m.dayIndex === d && m.hour === h);
      if (cell) {
        cell.count += 1;
      }
    });

    return res.status(200).json(matrix);
  } catch (err) {
    console.error('getThreatActivity error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getNetworkTraffic = async (req, res) => {
  try {
    const data = await queryNetworkTrafficDashboard();
    return res.status(200).json(data);
  } catch (err) {
    console.error('getNetworkTraffic error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getRiskStatus = async (req, res) => {
  try {
    const devices = await Device.find({}, 'name ip_address ipAddress risk_score status type zone');
    
    if (devices.length === 0) {
      return res.status(200).json({
        averageRisk: 0,
        topDevices: []
      });
    }

    // averageRisk = trung bình toàn hệ thống (kể cả device an toàn có score 0)
    const totalRisk = devices.reduce((sum, dev) => sum + (dev.risk_score || 0), 0);
    const averageRisk = Math.round((totalRisk / devices.length) * 10) / 10;

    // topDevices = chỉ thiết bị nguy cơ cao (risk_score >= 30), sắp xếp giảm dần
    const topDevices = [...devices]
      .filter(dev => (dev.risk_score || 0) >= 30)
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 5);

    return res.status(200).json({
      averageRisk,
      topDevices
    });
  } catch (err) {
    console.error('getRiskStatus error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
