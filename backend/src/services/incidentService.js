import incidentRepository from '../repositories/incidentRepository.js';
import incidentTimelineRepository from '../repositories/incidentTimelineRepository.js';
import deviceRepository from '../repositories/deviceRepository.js';
import alertRepository from '../repositories/alertRepository.js';
import notificationService from './notification.service.js';
import AppError from '../utils/AppError.js';
import { ROLES, INCIDENT_STATUSES, SEVERITY_LEVELS, INCIDENT_TIMELINE_TYPES } from '../constants/index.js';
import { analyzeIncident } from '../../../ai-services/index.js';
import { parsePagination, buildSortOption } from '../utils/pagination.js';
import { HTTP_STATUS } from '../constants/index.js';


class IncidentService {
  async getAll(queryParams, user) {
    const { search, status, severity, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    let conditions = [];

    // Normalize role check to lowercase for consistency
    if (user && user.id && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id);
      
      const userAlerts = await alertRepository.findAll({ device_id: { $in: userDeviceIds } }, {}, 0, 100000);
      const userAlertIds = userAlerts.map(a => a._id);

      conditions.push({
        $or: [
          { assigned_to: user.id },
          { alert_ids: { $in: userAlertIds } }
        ]
      });
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      conditions.push({
        $or: [{ title: searchRegex }, { description: searchRegex }]
      });
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    if (status) query.status = status;
    if (severity) query.severity = severity;

    const sortOption = buildSortOption(order);
    const { pageNumber, limitNumber, skip } = parsePagination(page, per_page);

    const sortDef = sortOption && Object.keys(sortOption).length ? sortOption : { createdAt: -1 };

    const pipeline = [
      { $match: query },
      { $sort: sortDef },
      { $group: {
          _id: { title: '$title' },
          latest_incident: { $first: '$$ROOT' },
          occurrences_count: { $sum: 1 }
      }},
      { $replaceRoot: { newRoot: { $mergeObjects: ['$latest_incident', { occurrences_count: '$occurrences_count' }] } } },
      { $sort: sortDef }
    ];

    const totalPipeline = [...pipeline, { $count: 'total' }];
    const totalRes = await incidentRepository.aggregate(totalPipeline);
    const total = totalRes.length > 0 ? totalRes[0].total : 0;

    const incidentsPipeline = [
      ...pipeline,
      { $skip: skip },
      { $limit: limitNumber },
      {
        $lookup: {
          from: 'users',
          localField: 'assigned_to',
          foreignField: '_id',
          as: 'assigned_to'
        }
      },
      { $unwind: { path: '$assigned_to', preserveNullAndEmptyArrays: true } }
    ];

    const incidents = await incidentRepository.aggregate(incidentsPipeline);

    return { incidents, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', HTTP_STATUS.NOT_FOUND);

    const timeline = await incidentTimelineRepository.findByIncidentId(id);

    let deviceAlertHistory = [];
    if (incident.alert_ids && incident.alert_ids.length > 0) {
      // Find the devices involved
      const alertRepository = (await import('../repositories/alertRepository.js')).default;
      const alerts = await alertRepository.findAll({ _id: { $in: incident.alert_ids } }, {}, 0, 1000);
      const deviceIds = [...new Set(alerts.map(a => a.device_id?._id?.toString() || a.device_id?.toString()).filter(Boolean))];

      if (deviceIds.length > 0) {
        deviceAlertHistory = await alertRepository.findAll({ device_id: { $in: deviceIds } }, { detected_at: 1 }, 0, 100);
      }
    }

    const history = await incidentRepository.findAll(
      { title: incident.title },
      { createdAt: -1 },
      0, 100
    );

    return { incident, timeline, deviceAlertHistory, history };
  }

  async create(data, user) {
    const { title, description, severity, status, alert_ids } = data;

    const incident = await incidentRepository.create({
      title,
      description,
      severity: severity || SEVERITY_LEVELS.MEDIUM,
      status: status || INCIDENT_STATUSES.OPEN,
      alert_ids: alert_ids || [],
      assigned_to: user ? user._id : null
    });

    await incidentTimelineRepository.create({
      incident_id: incident._id,
      actor: user ? user.username : 'system',
      action_type: INCIDENT_TIMELINE_TYPES.MANUAL_NOTE,
      description: `Sự cố được tạo thủ công bởi ${user ? user.username : 'system'}.`
    });

    await notificationService.createNotification({
      title: `Incident Created: ${title}`,
      message: description || `A new incident has been reported manually.`,
      type: 'SYSTEM',
      severity: severity || SEVERITY_LEVELS.MEDIUM,
      userId: null,
    });

    return incident;
  }

  async update(id, data) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', HTTP_STATUS.NOT_FOUND);

    const updateData = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;

    const result = await incidentRepository.updateById(id, updateData);

    if (incident.status === INCIDENT_STATUSES.INVESTIGATING && updateData.status === INCIDENT_STATUSES.INVESTIGATED) {
      let targetUserId = null;
      if (incident.alert_ids && incident.alert_ids.length > 0) {
        const alerts = await alertRepository.findAll({ _id: { $in: incident.alert_ids } }, {}, 0, 1);
        if (alerts.length > 0 && alerts[0].device_id) {
           const device = await deviceRepository.findById(alerts[0].device_id);
           if (device && device.userId) {
             targetUserId = device.userId;
           }
        }
      }

      await notificationService.createNotification({
        title: `Cập nhật sự cố: ${incident.title}`,
        message: `Sự cố đã được điều tra hoàn tất`,
        type: 'SYSTEM',
        severity: incident.severity,
        userId: targetUserId,
      });
    }

    return result;
  }

  async remove(id, user) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', HTTP_STATUS.NOT_FOUND);

    if (user && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id);
      const userAlerts = await alertRepository.findAll({ device_id: { $in: userDeviceIds } }, {}, 0, 100000);
      const userAlertIds = userAlerts.map(a => a._id.toString());

      const isAssignedToUser = incident.assigned_to?.toString() === user.id.toString();
      const hasUserAlerts = incident.alert_ids && incident.alert_ids.some(alertId => userAlertIds.includes(alertId.toString()));
      
      if (!isAssignedToUser && !hasUserAlerts) {
        throw new AppError('Forbidden: You can only delete incidents associated with your devices or assigned to you', HTTP_STATUS.FORBIDDEN);
      }
    }

    await incidentTimelineRepository.deleteByIncidentId(id);
    await incidentRepository.deleteById(id);
  }

  async removeMany(ids, user) {
    if (user && user.role?.toLowerCase() !== ROLES.ADMIN) {
      const userDevices = await deviceRepository.findAll({ userId: user.id }, {}, 0, 10000, '_id');
      const userDeviceIds = userDevices.map(d => d._id);
      const userAlerts = await alertRepository.findAll({ device_id: { $in: userDeviceIds } }, {}, 0, 100000);
      const userAlertIds = userAlerts.map(a => a._id.toString());

      const incidents = await incidentRepository.findAll({ _id: { $in: ids } }, {}, 0, ids.length);
      const invalidIncidents = incidents.filter(incident => {
        const isAssignedToUser = incident.assigned_to?.toString() === user.id.toString();
        const hasUserAlerts = incident.alert_ids && incident.alert_ids.some(alertId => userAlertIds.includes(alertId.toString()));
        return !isAssignedToUser && !hasUserAlerts;
      });

      if (invalidIncidents.length > 0) {
        throw new AppError('Forbidden: Some incidents do not belong to you', HTTP_STATUS.FORBIDDEN);
      }
    }

    await incidentTimelineRepository.deleteByIncidentIds(ids);
    return incidentRepository.deleteMany(ids);
  }

  async triggerAiAnalysis(id, user) {
    const incidentData = await this.getById(id);
    const incident = incidentData.incident;

    let alertsToProcess = incidentData.deviceAlertHistory;
    
    if (!alertsToProcess || alertsToProcess.length === 0) {
      alertsToProcess = incident.alert_ids;
    }

    if (!alertsToProcess || alertsToProcess.length === 0) {
      alertsToProcess = [{
        _id: 'dummy-alert',
        rule_name: 'TEST_RULE',
        device_id: 'dummy-device',
        title: 'Mock Alert for Testing',
        description: 'This is a mock alert because no real alerts were associated.',
        severity: SEVERITY_LEVELS.MEDIUM,
        status: INCIDENT_STATUSES.OPEN,
        source_ip: '192.168.1.100',
        destination_ip: '10.0.0.5',
        event_count: 1,
        raw_events_sample: [{ timestamp: new Date(), message: 'Mock event log line' }],
        detected_at: new Date()
      }];
    }

    await incidentRepository.updateById(id, { 
      status: INCIDENT_STATUSES.INVESTIGATING,
      ai_status: 'processing' 
    });

    await incidentTimelineRepository.create({
      incident_id: incident._id,
      actor: user ? user.username : 'Analyst',
      action_type: INCIDENT_TIMELINE_TYPES.AI_ANALYSIS,
      description: `Yêu cầu phân tích AI cho sự cố đã được gửi trực tiếp tới AI-Engine FastAPI.`,
    });

    const formattedIncident = {
      _id: incident._id.toString(),
      title: incident.title,
      description: incident.description,
      status: incident.status,
      severity: incident.severity,
      created_at: incident.createdAt || new Date(),
      updated_at: incident.updatedAt || new Date()
    };

    const formattedAlerts = alertsToProcess.map(alert => ({
      _id: alert._id.toString(),
      rule_name: alert.rule_name || 'UNKNOWN_RULE',
      device_id: alert.device_id,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: alert.status,
      source_ip: alert.source_ip || null,
      destination_ip: alert.destination_ip || null,
      event_count: alert.event_count || 1,
      raw_events_sample: (alert.raw_events_sample || []).map(ev => ({
        timestamp: ev.timestamp || new Date(),
        message: ev.message || ''
      })),
      detected_at: alert.detected_at || new Date()
    }));

    this.runBackgroundAiAnalysis(incident._id, formattedIncident, formattedAlerts);
    return incident;
  }

  async runBackgroundAiAnalysis(incidentId, incidentData, alertsData) {
    try {
      console.log(`[IncidentService] Calling AI Gemini Analysis for incident: ${incidentId}`);

      const aiReport = await analyzeIncident(incidentData, alertsData);

      console.log(`[IncidentService] AI Analysis completed successfully for incident ${incidentId}`);

      // Mark as investigated (distinct from investigating — AI has completed its analysis)
      await incidentRepository.updateById(incidentId, { 
        status: INCIDENT_STATUSES.INVESTIGATED,
        ai_status: 'completed',
        ai_result: aiReport
      });

      let targetUserId = null;
      if (alertsData && alertsData.length > 0 && alertsData[0].device_id) {
         const device = await deviceRepository.findById(alertsData[0].device_id);
         if (device && device.userId) {
           targetUserId = device.userId;
         }
      }

      await notificationService.createNotification({
        title: `AI đã phân tích - ${incidentData.title}`,
        message: `Hệ thống AI đã hoàn tất điều tra sự cố`,
        type: 'SYSTEM',
        severity: incidentData.severity,
        userId: targetUserId,
      });

      let mitreMappingsStr = '';
      if (aiReport.mitre_attack_mappings && aiReport.mitre_attack_mappings.length > 0) {
        mitreMappingsStr = '\n\n*Ánh xạ MITRE ATT&CK:*\n' +
          aiReport.mitre_attack_mappings.map(m => `- ${m.tactic}: ${m.technique_name} (${m.technique_id})`).join('\n');
      }

      const timelineDescription =
        `**Báo cáo Phân tích Sự cố từ AI Security Assistant**\n\n` +
        `*Mô hình sử dụng:* \`${aiReport.model_used}\`\n\n` +
        `*Tóm tắt sự kiện:* ${aiReport.log_summary}\n\n` +
        `*Phân tích chuỗi tấn công:* ${aiReport.attack_reasoning}` +
        `${mitreMappingsStr}\n\n` +
        `*Khuyến nghị khắc phục:* \n` +
        aiReport.remediation_advice.map((r, i) => `${i + 1}. **${r.step}** (Độ ưu tiên: *${r.priority}*)`).join('\n');

      await incidentTimelineRepository.create({
        incident_id: incidentId,
        actor: 'AI Security Assistant',
        action_type: INCIDENT_TIMELINE_TYPES.AI_ANALYSIS,
        description: timelineDescription,
        metadata: aiReport
      });

    } catch (error) {
      console.error(`[IncidentService] Background AI Analysis failed for incident ${incidentId}:`, error.message);
      await incidentRepository.updateById(incidentId, { 
        ai_status: 'failed',
        ai_result: { error: error.message }
      });
      await incidentTimelineRepository.create({
        incident_id: incidentId,
        actor: 'AI Security Assistant',
        action_type: INCIDENT_TIMELINE_TYPES.AI_ANALYSIS,
        description: `Lỗi khi phân tích sự cố bằng AI: ${error.message}. Vui lòng thử lại sau.`,
        metadata: { error: error.message }
      });
    }
  }
}

export default new IncidentService();
