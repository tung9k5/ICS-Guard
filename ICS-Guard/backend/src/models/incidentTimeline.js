import mongoose from 'mongoose';

const incidentTimelineSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
    index: true,
  },
  event_time: {
    type: Date,
    default: Date.now,
    index: true,
  },
  actor: {
    type: String,
    required: true,
  },
  action_type: {
    type: String,
    enum: ['incident_created', 'auto_response', 'ai_analysis', 'status_change', 'manual_note'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: false,
});

const IncidentTimeline = mongoose.model('IncidentTimeline', incidentTimelineSchema);

export default IncidentTimeline;
