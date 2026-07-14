import { Incident, Alert, IncidentTimeline, Device } from '../models/index.js';
import aiService from '../services/aiService.js';

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
    // Update Incident status to 'investigated'
    const incident = await Incident.findById(incidentId).populate('alert_ids');
    if (!incident) return;

    let deviceId = null;
    if (incident.alert_ids && incident.alert_ids.length > 0) {
      deviceId = incident.alert_ids[0].device_id;
    }
    
    let device = { name: 'Unknown', ipAddress: 'Unknown' };
    if (deviceId) {
      const dev = await Device.findById(deviceId).lean();
      if (dev) device = dev;
    }

    // Call the AI Service
    const aiReportText = await aiService.analyzeIncident(incident, device, alertsData);

    console.log(`[IncidentController] AI Analysis completed successfully for incident ${incidentId}`);

    incident.status = 'investigated';
    await incident.save();

    // Create Incident Timeline entry
    await IncidentTimeline.create({
      incident_id: incidentId,
      actor: 'AI Security Assistant',
      action_type: 'ai_analysis',
      description: aiReportText,
      metadata: { ai: true }
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
