import alertRepository from '../repositories/alertRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import AppError from '../utils/AppError.js';
import { ROLES, ALERT_STATUSES, AUDIT_STATUSES, AUDIT_ACTIONS } from '../constants/index.js';
import { parsePagination, buildSortOption } from '../utils/pagination.js';
import { HTTP_STATUS } from '../constants/index.js';


class AlertService {
  async getAll(queryParams, user) {
    const { search, status, severity, order, page = 1, per_page = 10, rule_name, device_id } = queryParams;

    let query = {};
    if (user && user.id && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      if (device_id && userDeviceIds.includes(device_id)) {
        query.device_id = device_id;
      } else if (device_id) {
        query.device_id = null; // No match
      } else {
        query.device_id = { $in: userDeviceIds };
      }
    } else if (device_id) {
      query.device_id = device_id;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }, { rule_name: searchRegex }];
    }
    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (rule_name) {
      const scenarioMap = {
        'FIRE': 'FIRE_ALARM',
        'OVERHEAT': 'CRITICAL_OVERHEAT',
        'TRAFFIC_SPIKE': 'ABNORMAL_TRAFFIC_SPIKE',
        'FLOOD': 'FLOOD_WARNING'
      };
      
      if (scenarioMap[rule_name]) {
        query.rule_name = scenarioMap[rule_name];
      } else if (rule_name === 'NORMAL') {
        query.rule_name = { $nin: Object.values(scenarioMap) };
      } else if (rule_name === 'OFFLINE') {
        query.rule_name = 'DEVICE_OFFLINE'; // Assuming OFFLINE maps to this
      } else {
        query.rule_name = rule_name;
      }
    }
    if (device_id) query.device_id = device_id;

    // Alert sorts by detected_at, not createdAt
    const sortOption = buildSortOption(order, 'detected_at');
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    // Group by device_id and rule_name
    const sortDef = sortOption && Object.keys(sortOption).length ? sortOption : { detected_at: -1 };
    
    const pipeline = [
      { $match: query },
      { $sort: sortDef },
      { $group: {
          _id: { device_id: '$device_id', rule_name: '$rule_name' },
          latest_alert: { $first: '$$ROOT' },
          occurrences_count: { $sum: 1 }
      }},
      { $replaceRoot: { newRoot: { $mergeObjects: ['$latest_alert', { occurrences_count: '$occurrences_count' }] } } },
      { $sort: sortDef }
    ];

    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalRes = await alertRepository.aggregate(totalPipeline);
    const total = totalRes.length > 0 ? totalRes[0].total : 0;

    const alertsPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limitNumber },
      {
        $lookup: {
          from: 'devices',
          localField: 'device_id',
          foreignField: '_id',
          as: 'device_id'
        }
      },
      { $unwind: { path: '$device_id', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'incidents',
          localField: 'incident_id',
          foreignField: '_id',
          as: 'incident_id'
        }
      },
      { $unwind: { path: '$incident_id', preserveNullAndEmptyArrays: true } }
    ];

    const alerts = await alertRepository.aggregate(alertsPipeline);

    return { alerts, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', HTTP_STATUS.NOT_FOUND);

    const history = await alertRepository.findAll(
      { device_id: alert.device_id?._id || alert.device_id, rule_name: alert.rule_name },
      { detected_at: -1 },
      0, 100 // Get up to 100 occurrences
    );

    return { alert, history };
  }

  async updateStatus(id, status, user) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', HTTP_STATUS.NOT_FOUND);

    const updateData = { status };
    if ([ALERT_STATUSES.RESOLVED, ALERT_STATUSES.FALSE_POSITIVE].includes(status)) {
      updateData.resolved_at = new Date();
      updateData.resolved_by = user.username;
    }

    const updatedAlert = await alertRepository.updateStatusById(id, updateData);

    if (alert.device_id && [ALERT_STATUSES.RESOLVED, ALERT_STATUSES.FALSE_POSITIVE].includes(status)) {
      await deviceRepository.updateById(alert.device_id._id, { current_scenario: 'NORMAL' });
    }

    await auditRepository.create({
      action: AUDIT_ACTIONS.ALERT_STATUS_UPDATED,
      username: user.username,
      details: { alertId: id, oldStatus: alert.status, newStatus: status },
      status: AUDIT_STATUSES.SUCCESS,
    });

    return updatedAlert;
  }

  async remove(id, user) {
    const alert = await alertRepository.findById(id);
    if (!alert) throw new AppError('Alert not found', HTTP_STATUS.NOT_FOUND);

    if (user && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      if (alert.device_id && !userDeviceIds.includes(alert.device_id._id?.toString() || alert.device_id.toString())) {
        throw new AppError('Forbidden: You can only delete alerts associated with your devices', HTTP_STATUS.FORBIDDEN);
      }
    }

    const deviceIdVal = alert.device_id?._id || alert.device_id;
    if (deviceIdVal) {
      await alertRepository.deleteManyByQuery({ device_id: deviceIdVal, rule_name: alert.rule_name });
    } else {
      await alertRepository.deleteById(id);
    }
  }

  async removeMany(ids, user) {
    const alerts = await alertRepository.findAll({ _id: { $in: ids } }, {}, 0, ids.length);
    if (user && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id.toString());
      
      const invalidAlerts = alerts.filter(alert => alert.device_id && !userDeviceIds.includes(alert.device_id._id?.toString() || alert.device_id.toString()));
      if (invalidAlerts.length > 0) {
        throw new AppError('Forbidden: Some alerts do not belong to your devices', HTTP_STATUS.FORBIDDEN);
      }
    }

    const orQueries = alerts.map(alert => ({
      device_id: alert.device_id?._id || alert.device_id,
      rule_name: alert.rule_name
    })).filter(q => q.device_id);

    if (orQueries.length > 0) {
      return alertRepository.deleteManyByQuery({ $or: orQueries });
    } else {
      return alertRepository.deleteMany(ids);
    }
  }

  async generateFakeAlerts(count, user) {
    let query = {};
    if (user && user.role?.toLowerCase() !== ROLES.ADMIN) {
      query.userId = user.id;
    }
    const devices = await deviceRepository.findAll(query, {}, 0, 10000);
    
    const deviceList = devices.length > 0 ? devices : [{ _id: 'dummy_device_1', name: 'Dummy Device' }];

    const alerts = [];
    const statuses = Object.values(ALERT_STATUSES);
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']; // Assuming SEVERITY_LEVELS isn't imported here

    for (let i = 0; i < count; i++) {
      const device = deviceList[Math.floor(Math.random() * deviceList.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      
      const detected_at = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000); // within last 30 days
      let resolved_at = null;
      
      if (status === ALERT_STATUSES.RESOLVED || status === ALERT_STATUSES.FALSE_POSITIVE) {
        resolved_at = new Date(detected_at.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
      }

      alerts.push({
        rule_name: `Rule-${Math.floor(Math.random() * 10)}`,
        device_id: device._id,
        title: `Generated Alert ${i + 1}`,
        description: `This is a generated alert for device ${device.name || 'Unknown'}.`,
        severity,
        status,
        detected_at,
        resolved_at,
        resolved_by: resolved_at ? 'system' : null,
      });
    }

    await alertRepository.insertMany(alerts);
  }
}

export default new AlertService();
