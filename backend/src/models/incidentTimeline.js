import mongoose from 'mongoose';
import { INCIDENT_TIMELINE_TYPES } from '../constants/index.js';

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
    enum: Object.values(INCIDENT_TIMELINE_TYPES),
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
