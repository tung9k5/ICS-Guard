import { Alert, Incident, Device } from '../models/index.js';

class ReportService {
  async getSummaryReport(queryParams) {
    const { start_date, end_date } = queryParams;

    let query = {};
    if (start_date && end_date) {
      query.createdAt = {
        $gte: new Date(start_date),
        $lte: new Date(end_date),
      };
    }

    const [
      totalIncidentsRes,
      totalAlertsRes,
      totalDevices,
      incidentsByStatus,
      alertsBySeverity,
      alertsTrend,
      incidentsTrend
    ] = await Promise.all([
      Incident.aggregate([
        { $match: query },
        { $lookup: { from: 'alerts', localField: 'alert_ids', foreignField: '_id', as: 'alerts' } },
        { $lookup: { from: 'devices', localField: 'alerts.device_id', foreignField: '_id', as: 'devices' } },
        { $match: { 'devices.0': { $exists: true } } },
        { $count: 'count' }
      ]),
      Alert.aggregate([
        { $match: query },
        { $lookup: { from: 'devices', localField: 'device_id', foreignField: '_id', as: 'device' } },
        { $match: { 'device.0': { $exists: true } } },
        { $count: 'count' }
      ]),
      Device.countDocuments(),
      Incident.aggregate([
        { $match: query },
        { $lookup: { from: 'alerts', localField: 'alert_ids', foreignField: '_id', as: 'alerts' } },
        { $lookup: { from: 'devices', localField: 'alerts.device_id', foreignField: '_id', as: 'devices' } },
        { $match: { 'devices.0': { $exists: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Alert.aggregate([
        { $match: query },
        { $lookup: { from: 'devices', localField: 'device_id', foreignField: '_id', as: 'device' } },
        { $match: { 'device.0': { $exists: true } } },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      Alert.aggregate([
        { $match: query },
        { $lookup: { from: 'devices', localField: 'device_id', foreignField: '_id', as: 'device' } },
        { $match: { 'device.0': { $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      Incident.aggregate([
        { $match: query },
        { $lookup: { from: 'alerts', localField: 'alert_ids', foreignField: '_id', as: 'alerts' } },
        { $lookup: { from: 'devices', localField: 'alerts.device_id', foreignField: '_id', as: 'devices' } },
        { $match: { 'devices.0': { $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    const totalIncidents = totalIncidentsRes.length > 0 ? totalIncidentsRes[0].count : 0;
    const totalAlerts = totalAlertsRes.length > 0 ? totalAlertsRes[0].count : 0;

    return {
      totalIncidents,
      totalAlerts,
      totalDevices,
      incidentsByStatus: incidentsByStatus.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      alertsBySeverity: alertsBySeverity.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      alertsTrend: alertsTrend.map(item => ({ date: item._id, alerts: item.count })),
      incidentsTrend: incidentsTrend.map(item => ({ date: item._id, incidents: item.count })),
    };
  }
}

export default new ReportService();
