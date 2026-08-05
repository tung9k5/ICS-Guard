import mongoose from 'mongoose';
import {
  AUDIT_STATUSES,
  REMEDIATION_ACTOR_TYPES,
} from '../constants/index.js';

const remediationActionLogSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
    index: true,
  },
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RemediationSession',
    required: true,
    index: true,
  },
  step_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RemediationStep',
    default: null,
    index: true,
  },
  actor_type: {
    type: String,
    enum: Object.values(REMEDIATION_ACTOR_TYPES),
    default: REMEDIATION_ACTOR_TYPES.USER,
  },
  actor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  actor_name: {
    type: String,
    default: 'System',
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  before_state: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  after_state: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: Object.values(AUDIT_STATUSES),
    default: AUDIT_STATUSES.SUCCESS,
  },
}, {
  timestamps: true,
});

remediationActionLogSchema.index({ session_id: 1, createdAt: -1 });

const RemediationActionLog = mongoose.model('RemediationActionLog', remediationActionLogSchema);

export default RemediationActionLog;
