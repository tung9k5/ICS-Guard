import { Incident, Alert, IncidentTimeline } from '../models/index.js';
import { sendToQueue } from '../services/queueService.js';

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

    // Get the first alert to analyze
    const alert = incident.alert_ids[0];
    const payload = {
      alertId: alert._id,
      deviceId: alert.device_id,
      description: alert.description,
    };

    // Push task to RabbitMQ for AI analysis
    await sendToQueue('ai_analysis_queue', payload);

    // Update incident status to 'investigating'
    incident.status = 'investigating';
    await incident.save();

    // Log action to Incident Timeline
    await IncidentTimeline.create({
      incident_id: incident._id,
      actor: req.user ? req.user.username : 'Analyst',
      action_type: 'ai_analysis',
      description: `Yêu cầu phân tích AI cho cảnh báo ID ${alert._id} đã được gửi lên hàng đợi RabbitMQ.`,
    });

    return res.status(200).json({
      message: 'AI analysis request sent successfully.',
      incident,
    });
  } catch (error) {
    console.error('TriggerAiAnalysis error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to trigger AI analysis.' });
  }
};

export default {
  getAllIncidents,
  getIncidentById,
  triggerAiAnalysis,
};
