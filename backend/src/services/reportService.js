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
      totalIncidents,
      totalAlerts,
      totalDevices,
      incidentsByStatus,
      alertsBySeverity,
      alertsTrend,
      incidentsTrend
    ] = await Promise.all([
      Incident.countDocuments(query),
      Alert.countDocuments(query),
      Device.countDocuments(),
      Incident.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Alert.aggregate([
        { $match: query },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      Alert.aggregate([
        { $match: query },
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
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

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
