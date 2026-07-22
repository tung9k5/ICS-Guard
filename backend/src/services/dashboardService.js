import deviceRepository from '../repositories/deviceRepository.js';
import alertRepository from '../repositories/alertRepository.js';
import incidentRepository from '../repositories/incidentRepository.js';
import { Alert } from '../models/index.js';
import axios from 'axios';

class DashboardService {
  async getSystemHealth() {
    const totalDevices = await deviceRepository.countAll({});
    const activeDevices = await deviceRepository.countAll({ status: 'active' });
    const isolatedDevices = await deviceRepository.countAll({ status: 'isolated' });
    const offlineDevices = await deviceRepository.countAll({ status: 'offline' });

    return [
      { key: 'active', value: activeDevices },
      { key: 'isolated', value: isolatedDevices },
      { key: 'offline', value: offlineDevices }
    ];
  }

  async getThreatActivity() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo, $lte: today }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          low: {
            $sum: { $cond: [{ $eq: ["$severity", "INFO"] }, 1, 0] }
          },
          medium: {
            $sum: { $cond: [{ $eq: ["$severity", "MEDIUM"] }, 1, 0] }
          },
          high: {
            $sum: {
              $cond: [
                { $in: ["$severity", ["HIGH", "CRITICAL"]] }, 1, 0
              ]
            }
          }
        }
      }
    ];

    const results = await Alert.aggregate(pipeline);

    const threatData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      const dayName = dayNames[d.getDay()];
      
      const found = results.find(r => r._id.year === d.getFullYear() && r._id.month === d.getMonth() + 1 && r._id.day === d.getDate());
      
      threatData.push({
        key: dayName,
        low: found ? found.low : 0,
        medium: found ? found.medium : 0,
        high: found ? found.high : 0
      });
    }

    return threatData;
  }

  async getNetworkTraffic() {
    const INFLUXDB_URL = process.env.INFLUXDB_URL;
    const DB_NAME = process.env.INFLUXDB_DB;
    const queryUrl = `${INFLUXDB_URL}/query`;
    
    // Group by 3h for the last 24h
    const query = encodeURIComponent(`SELECT SUM(bytes_per_second) as bytes FROM device_metrics WHERE time > now() - 24h GROUP BY time(3h)`);
    
    const trafficData = [];
    const now = new Date();
    
    try {
      const response = await axios.get(`${queryUrl}?db=${DB_NAME}&q=${query}`);
      const results = response.data?.results?.[0]?.series?.[0]?.values || [];
      
      for (let i = 21; i >= 0; i -= 3) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const timeKey = `${String(d.getHours()).padStart(2, '0')}:00`;
        
        const found = results.find(row => {
            if (!row[0]) return false;
            const rowDate = new Date(row[0]);
            // Find closest 3-hour bucket
            const diffHours = Math.abs((rowDate.getTime() - d.getTime()) / (1000 * 60 * 60));
            return diffHours <= 3;
        });
        
        const bytes = found && found[1] ? found[1] : 0;
        
        trafficData.push({
          time: timeKey,
          incoming: Math.floor(bytes * 0.7),
          outgoing: Math.floor(bytes * 0.3)
        });
      }
    } catch (error) {
      console.error('Error fetching network traffic from InfluxDB:', error.message);
      for (let i = 21; i >= 0; i -= 3) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        trafficData.push({
          time: `${String(d.getHours()).padStart(2, '0')}:00`,
          incoming: 0,
          outgoing: 0
        });
      }
    }
    
    return trafficData;
  }
}

export default new DashboardService();
