import mongoose from 'mongoose';
import { ALERT_STATUSES, SEVERITY_LEVELS } from '../constants/index.js';

const alertSchema = new mongoose.Schema({
  rule_name: {
    type: String,
    index: true,
  },
  device_id: {
    type: String,
    ref: 'Device',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  severity: {
    type: String,
    enum: Object.values(SEVERITY_LEVELS),
    default: SEVERITY_LEVELS.MEDIUM,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(ALERT_STATUSES),
    default: ALERT_STATUSES.NEW,
    index: true,
  },
  source_ip: {
    type: String,
    index: true,
  },
  destination_ip: {
    type: String,
  },
  event_count: {
    type: Number,
    default: 1,
  },
  raw_events_sample: [
    {
      timestamp: Date,
      message: String,
    }
  ],
  detected_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
  resolved_at: {
    type: Date,
    default: null,
  },
  resolved_by: {
    type: String,
    default: null,
  },
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    default: null,
  },
}, {
  timestamps: true,
});

const Alert = mongoose.model('Alert', alertSchema);

export default Alert;
