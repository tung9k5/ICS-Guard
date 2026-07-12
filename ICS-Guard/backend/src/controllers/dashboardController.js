import { Device, Incident } from '../models/index.js';

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

    // Khởi tạo data 7 ngày
    const daysMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const rawData = {};
    
    // Tạo danh sách 7 ngày gần nhất để đảm bảo có đủ data kể cả ngày không có incident
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = daysMap[d.getDay()];
      rawData[dayKey] = { key: dayKey, high: 0, medium: 0, low: 0 };
    }

    // Đếm số lượng theo mức độ
    incidents.forEach(incident => {
      const dayKey = daysMap[new Date(incident.createdAt).getDay()];
      if (rawData[dayKey]) {
        if (incident.severity === 'CRITICAL' || incident.severity === 'HIGH') {
          rawData[dayKey].high += 1;
        } else if (incident.severity === 'MEDIUM') {
          rawData[dayKey].medium += 1;
        } else if (incident.severity === 'LOW') {
          rawData[dayKey].low += 1;
        }
      }
    });

    // Chuyển object thành mảng, sắp xếp theo thứ tự 7 ngày qua
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayKey = daysMap[d.getDay()];
      data.push(rawData[dayKey]);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('getThreatActivity error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getNetworkTraffic = async (req, res) => {
  try {
    // Generate mock data cho 24 giờ
    const data = [];
    let baseIncoming = 2000;
    let baseOutgoing = 1000;

    for (let i = 0; i <= 24; i += 4) {
      const timeLabel = i < 10 ? `0${i}:00` : `${i}:00`;
      
      // Randomize traffic
      const incoming = Math.floor(baseIncoming + Math.random() * 2000);
      const outgoing = Math.floor(baseOutgoing + Math.random() * 1500);

      data.push({ time: timeLabel, incoming, outgoing });
      
      // Update base for smooth trend
      baseIncoming = incoming - 500;
      baseOutgoing = outgoing - 300;
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('getNetworkTraffic error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
