import axios from 'axios';
import incidentRepository from '../repositories/incidentRepository.js';
import incidentTimelineRepository from '../repositories/incidentTimelineRepository.js';
import AppError from '../utils/AppError.js';
import { ROLES, INCIDENT_STATUSES, SEVERITY_LEVELS, INCIDENT_TIMELINE_TYPES } from '../constants/index.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL;

class IncidentService {
  async getAll(queryParams, user) {
    const { search, status, severity, order, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (user && user.id && user.role !== ROLES.ADMIN && user.role !== 'Admin') {
      query.assigned_to = user.id;
    }

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [{ title: searchRegex }, { description: searchRegex }];
    }
    if (status) query.status = status;
    if (severity) query.severity = severity;

    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await incidentRepository.countAll(query);
    const incidents = await incidentRepository.findAll(query, sortOption, skip, limitNumber);

    return { incidents, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', 404);

    const timeline = await incidentTimelineRepository.findByIncidentId(id);
    return { incident, timeline };
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

    return incident;
  }

  async update(id, data) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', 404);

    const updateData = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;

    return incidentRepository.updateById(id, updateData);
  }

  async remove(id) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', 404);

    await incidentTimelineRepository.deleteByIncidentId(id);
    await incidentRepository.deleteById(id);
  }

  async removeMany(ids) {
    await incidentTimelineRepository.deleteByIncidentIds(ids);
    return incidentRepository.deleteMany(ids);
  }

  async triggerAiAnalysis(id, user) {
    const incident = await incidentRepository.findById(id);
    if (!incident) throw new AppError('Incident not found', 404);

    let alertsToProcess = incident.alert_ids;
    if (alertsToProcess.length === 0) {
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

    await incidentRepository.updateById(id, { status: INCIDENT_STATUSES.INVESTIGATING });

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
      const analyzeUrl = `${AI_ENGINE_URL}/api/v1/analyze`;
      console.log(`[IncidentService] Calling AI Engine at: ${analyzeUrl}`);

      const response = await axios.post(analyzeUrl, {
        incident: incidentData,
        alerts: alertsData
      }, {
        timeout: 120000
      });

      const aiReport = response.data;
      console.log(`[IncidentService] AI Analysis completed successfully for incident ${incidentId}`);

      await incidentRepository.updateById(incidentId, { status: 'investigated' });

      let mitreMappingsStr = '';
      if (aiReport.mitre_attack_mappings && aiReport.mitre_attack_mappings.length > 0) {
        mitreMappingsStr = '\n\n*Ánh xạ MITRE ATT&CK:*\n' + 
          aiReport.mitre_attack_mappings.map(m => `- ${m.tactic}: ${m.technique_name} (${m.technique_id})`).join('\n');
      }

      const timelineDescription = 
        `🤖 **Báo cáo Phân tích Sự cố từ AI Security Assistant**\n\n` +
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
      await incidentTimelineRepository.create({
        incident_id: incidentId,
        actor: 'AI Security Assistant',
        action_type: INCIDENT_TIMELINE_TYPES.AI_ANALYSIS,
        description: `❌ Lỗi khi phân tích sự cố bằng AI: ${error.message}. Vui lòng thử lại sau.`,
        metadata: { error: error.message }
      });
    }
  }
}

export default new IncidentService();
