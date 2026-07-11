import axios from 'axios';
import { Incident, Alert, IncidentTimeline } from '../models/index.js';

import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5000';

export const getAllIncidents = async (req, res) => {
  try {
    const { search, status, severity, order, page = 1, per_page = 10 } = req.query;

    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (severity) {
      query.severity = severity;
    }

    let sortOption = {};
    if (order === 'asc') {
      sortOption = { createdAt: 1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Incident.countDocuments(query);
    const incidents = await Incident.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/incidents'}`;
    const paginated = formatPagination(incidents, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách sự cố thành công');
  } catch (error) {
    console.error('GetAllIncidents error:', error);
    return errorResponse(res, 'Failed to retrieve incidents', error.message);
  }
};

export const getIncidentById = async (req, res) => {
  const { id } = req.params;
  try {
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found.' });
    }

    const timeline = await IncidentTimeline.find({ incident_id: id }).sort({ event_time: 1 });

    return res.status(200).json({
      incident,
      timeline,
    });
  } catch (error) {
    console.error('GetIncidentById error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve incident.' });
  }
};

export const triggerAiAnalysis = async (req, res) => {
  const { id } = req.params;

  try {
    const incident = await Incident.findById(id).populate('alert_ids');
    if (!incident) {
      return res.status(404).json({ error: 'Not Found', message: 'Incident not found.' });
    }

    // For testing purposes, if no alerts are associated, we provide a dummy alert instead of blocking
    let alertsToProcess = incident.alert_ids;
    if (alertsToProcess.length === 0) {
      alertsToProcess = [{
        _id: 'dummy-alert',
        rule_name: 'TEST_RULE',
        device_id: 'dummy-device',
        title: 'Mock Alert for Testing',
        description: 'This is a mock alert because no real alerts were associated.',
        severity: 'MEDIUM',
        status: 'open',
        source_ip: '192.168.1.100',
        destination_ip: '10.0.0.5',
        event_count: 1,
        raw_events_sample: [{ timestamp: new Date(), message: 'Mock event log line' }],
        detected_at: new Date()
      }];
    }

    // Update incident status to 'investigating'
    incident.status = 'investigating';
    await incident.save();

    // Log request to timeline
    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'Analyst',
      action_type: 'ai_analysis',
      description: `Yêu cầu phân tích AI cho sự cố đã được gửi trực tiếp tới AI-Engine FastAPI.`,
    });

    // Map Mongoose documents to the schemas expected by Python Pydantic models
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

    // Call AI-Engine REST API asynchronously (non-blocking for HTTP response)
    // We do it in background so the UI doesn't hang waiting for AI which takes seconds
    runBackgroundAiAnalysis(incident._id, formattedIncident, formattedAlerts);

    return res.status(200).json({
      message: 'AI analysis triggered successfully. Results will populate the incident timeline shortly.',
      incident,
    });
  } catch (error) {
    console.error('TriggerAiAnalysis error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to trigger AI analysis.' });
  }
};

const runBackgroundAiAnalysis = async (incidentId, incidentData, alertsData) => {
  try {
    const analyzeUrl = `${AI_ENGINE_URL}/api/v1/analyze`;
    console.log(`[IncidentController] Calling AI Engine at: ${analyzeUrl}`);

    const response = await axios.post(analyzeUrl, {
      incident: incidentData,
      alerts: alertsData
    }, {
      timeout: 120000 // 2 minutes timeout for LLM
    });

    const aiReport = response.data;
    console.log(`[IncidentController] AI Analysis completed successfully for incident ${incidentId}`);

    // Update Incident status to 'investigated'
    const incident = await Incident.findById(incidentId);
    if (incident) {
      incident.status = 'investigated';
      await incident.save();
    }

    // Formulate a beautiful markdown-styled timeline description
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

    // Create Incident Timeline entry
    await IncidentTimeline.create({
      incident_id: incidentId,
      actor: 'AI Security Assistant',
      action_type: 'ai_analysis',
      description: timelineDescription,
      metadata: aiReport
    });

  } catch (error) {
    console.error(`[IncidentController] Background AI Analysis failed for incident ${incidentId}:`, error.message);
    
    // Log failure to timeline
    await IncidentTimeline.create({
      incident_id: incidentId,
      actor: 'AI Security Assistant',
      action_type: 'ai_analysis',
      description: `❌ Lỗi khi phân tích sự cố bằng AI: ${error.message}. Vui lòng thử lại sau.`,
      metadata: { error: error.message }
    });
  }
};

export const updateIncident = async (req, res) => {
  const { id } = req.params;
  const { status, severity, title, description } = req.body;

  try {
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    if (status !== undefined) incident.status = status;
    if (severity !== undefined) incident.severity = severity;
    if (title !== undefined) incident.title = title;
    if (description !== undefined) incident.description = description;

    await incident.save();

    return successResponse(res, incident, 'Cập nhật sự cố thành công');
  } catch (error) {
    console.error('UpdateIncident error:', error);
    return errorResponse(res, 'Failed to update incident', error.message);
  }
};

export const deleteIncident = async (req, res) => {
  const { id } = req.params;

  try {
    const incident = await Incident.findById(id);
    if (!incident) {
      return errorResponse(res, 'Incident not found', null, 404);
    }

    await IncidentTimeline.deleteMany({ incident_id: id });
    await incident.deleteOne();

    return successResponse(res, null, 'Xóa sự cố thành công');
  } catch (error) {
    console.error('DeleteIncident error:', error);
    return errorResponse(res, 'Failed to delete incident', error.message);
  }
};

export const deleteMultipleIncidents = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Danh sách ID sự cố không hợp lệ', null, 400);
  }

  try {
    await IncidentTimeline.deleteMany({ incident_id: { $in: ids } });
    const result = await Incident.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, `Xóa thành công ${result.deletedCount} sự cố`);
  } catch (error) {
    console.error('DeleteMultipleIncidents error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách sự cố', error.message);
  }
};

export default {
  getAllIncidents,
  getIncidentById,
  triggerAiAnalysis,
  updateIncident,
  deleteIncident,
  deleteMultipleIncidents,
};
