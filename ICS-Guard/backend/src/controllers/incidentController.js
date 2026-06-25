import axios from 'axios';
import { Incident, Alert, IncidentTimeline } from '../models/index.js';

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5000';

export const getAllIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 });
    return res.status(200).json(incidents);
  } catch (error) {
    console.error('GetAllIncidents error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to retrieve incidents.' });
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

    if (incident.alert_ids.length === 0) {
      return res.status(400).json({ error: 'Bad Request', message: 'No alerts associated with this incident.' });
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

    const formattedAlerts = incident.alert_ids.map(alert => ({
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

export default {
  getAllIncidents,
  getIncidentById,
  triggerAiAnalysis,
};
