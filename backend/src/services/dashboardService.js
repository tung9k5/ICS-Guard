import deviceRepository from '../repositories/deviceRepository.js';
import alertRepository from '../repositories/alertRepository.js';
import incidentRepository from '../repositories/incidentRepository.js';
import { Alert } from '../models/index.js';
import axios from 'axios';
import { ROLES } from '../constants/index.js';

class DashboardService {
  async getCustomerSummary(user) {
    // Determine devices for this user
    const isCustomer = user && user.role?.toLowerCase() !== ROLES.ADMIN;
    let deviceQuery = {};
    if (isCustomer) {
      deviceQuery.userId = user._id;
    }
    const totalDevices = await deviceRepository.countAll(deviceQuery);

    let alertMatch = {};
    if (isCustomer) {
      const userDevices = await deviceRepository.findAll(deviceQuery, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      alertMatch = { device_id: { $in: userDeviceIds } };
    }

    const groupedAlertsRes = await alertRepository.aggregate([
      { $match: alertMatch },
      { $lookup: { from: 'devices', localField: 'device_id', foreignField: '_id', as: 'device' } },
      { $match: { 'device.0': { $exists: true } } },
      { $group: { _id: { device_id: '$device_id', rule_name: '$rule_name' } } },
      { $count: 'total' }
    ]);
    const totalAlerts = groupedAlertsRes.length > 0 ? groupedAlertsRes[0].total : 0;

    const activeGroupedAlertsRes = await alertRepository.aggregate([
      { $match: { ...alertMatch, status: { $in: ['new', 'acknowledged'] } } },
      { $lookup: { from: 'devices', localField: 'device_id', foreignField: '_id', as: 'device' } },
      { $match: { 'device.0': { $exists: true } } },
      { $group: { _id: { device_id: '$device_id', rule_name: '$rule_name' } } },
      { $count: 'total' }
    ]);
    const activeAlerts = activeGroupedAlertsRes.length > 0 ? activeGroupedAlertsRes[0].total : 0;

    // Recent 5 alerts
    const recentAlerts = await alertRepository.findAll(alertMatch, { detected_at: -1 }, 0, 5);

    let incidentMatch = {};
    if (isCustomer) {
      const userAlerts = await alertRepository.findAll(alertMatch, {}, 0, 100000);
      const userAlertIds = userAlerts.map(a => a._id);
      
      incidentMatch = {
        $or: [
          { assigned_to: user._id },
          { alert_ids: { $in: userAlertIds } }
        ]
      };
    }
    const groupedIncidentsRes = await incidentRepository.aggregate([
      { $match: incidentMatch },
      { $lookup: { from: 'alerts', localField: 'alert_ids', foreignField: '_id', as: 'alerts' } },
      { $lookup: { from: 'devices', localField: 'alerts.device_id', foreignField: '_id', as: 'devices' } },
      { $match: { 'devices.0': { $exists: true } } },
      { $group: { _id: { title: '$title' } } },
      { $count: 'total' }
    ]);
    const totalIncidents = groupedIncidentsRes.length > 0 ? groupedIncidentsRes[0].total : 0;

    return {
      devices: totalDevices,
      alerts: totalAlerts,
      activeAlerts: activeAlerts,
      incidents: totalIncidents,
      recentAlerts: recentAlerts
    };
  }
  async getSystemHealth(user) {
    const isCustomer = user && user.role?.toLowerCase() !== ROLES.ADMIN;
    let query = {};
    if (isCustomer) {
      query.userId = user._id;
    }

    const activeDevices = await deviceRepository.countAll({ ...query, status: 'active' });
    const isolatedDevices = await deviceRepository.countAll({ ...query, status: 'isolated' });
    const offlineDevices = await deviceRepository.countAll({ ...query, status: 'offline' });

    return [
      { key: 'active', value: activeDevices },
      { key: 'isolated', value: isolatedDevices },
      { key: 'offline', value: offlineDevices }
    ];
  }

  async getThreatActivity(user) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const isCustomer = user && user.role?.toLowerCase() !== ROLES.ADMIN;
    let deviceMatch = {};
    if (isCustomer) {
      const userDevices = await deviceRepository.findAll({ userId: user._id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      deviceMatch = { device_id: { $in: userDeviceIds } };
    }

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo, $lte: today },
          ...deviceMatch
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
            $sum: { $cond: [{ $in: ["$severity", ["LOW", "INFO", "low", "info"]] }, 1, 0] }
          },
          medium: {
            $sum: { $cond: [{ $in: ["$severity", ["MEDIUM", "medium"]] }, 1, 0] }
          },
          high: {
            $sum: {
              $cond: [
                { $in: ["$severity", ["HIGH", "CRITICAL", "high", "critical"]] }, 1, 0
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

  async getNetworkTraffic(user) {
    const INFLUXDB_URL = process.env.INFLUXDB_URL;
    const DB_NAME = process.env.INFLUXDB_DB;
    const queryUrl = `${INFLUXDB_URL}/query`;
    
    const isCustomer = user && user.role?.toLowerCase() !== ROLES.ADMIN;
    let deviceFilter = '';
    if (isCustomer) {
      const userDevices = await deviceRepository.findAll({ userId: user._id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      if (userDeviceIds.length > 0) {
        deviceFilter = ` AND (${userDeviceIds.map(id => "device_id = '" + id + "'").join(' OR ')})`;
      } else {
        deviceFilter = ` AND device_id = 'NONE'`;
      }
    }

    // Group by 3h for the last 24h
    const query = encodeURIComponent(`SELECT SUM(bytes_per_second) as bytes FROM device_metrics WHERE time > now() - 24h${deviceFilter} GROUP BY time(3h)`);
    
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
