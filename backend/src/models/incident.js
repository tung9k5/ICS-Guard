import mongoose from 'mongoose';
import { INCIDENT_STATUSES, SEVERITY_LEVELS } from '../constants/index.js';

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(INCIDENT_STATUSES),
    default: INCIDENT_STATUSES.OPEN,
    index: true,
  },
  severity: {
    type: String,
    enum: Object.values(SEVERITY_LEVELS),
    default: SEVERITY_LEVELS.MEDIUM,
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  alert_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
  }],
}, {
  timestamps: true,
});

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
