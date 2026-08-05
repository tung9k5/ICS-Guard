import mongoose from 'mongoose';
import {
  REMEDIATION_ACTION_KEYS,
  REMEDIATION_ACTION_TYPES,
  REMEDIATION_STEP_STATUSES,
  SEVERITY_LEVELS,
} from '../constants/index.js';

const remediationStepSchema = new mongoose.Schema({
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RemediationSession',
    required: true,
    index: true,
  },
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
    index: true,
  },
  step_order: {
    type: Number,
    required: true,
    min: 1,
  },
  type: {
    type: String,
    enum: Object.values(REMEDIATION_ACTION_TYPES),
    default: REMEDIATION_ACTION_TYPES.MANUAL,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  action_key: {
    type: String,
    enum: Object.values(REMEDIATION_ACTION_KEYS),
    required: true,
    index: true,
  },
  action_params: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  expected_result: {
    type: String,
    default: '',
  },
  rollback_action_key: {
    type: String,
    enum: Object.values(REMEDIATION_ACTION_KEYS),
    default: null,
  },
  rollback_params: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  risk_level: {
    type: String,
    enum: Object.values(SEVERITY_LEVELS),
    default: SEVERITY_LEVELS.MEDIUM,
  },
  requires_approval: {
    type: Boolean,
    default: false,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(REMEDIATION_STEP_STATUSES),
    default: REMEDIATION_STEP_STATUSES.PENDING,
    index: true,
  },
  approved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  approved_at: {
    type: Date,
    default: null,
  },
  executed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  executed_at: {
    type: Date,
    default: null,
  },
  result: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  error: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

remediationStepSchema.index({ session_id: 1, step_order: 1 }, { unique: true });
remediationStepSchema.index({ incident_id: 1, status: 1 });

const RemediationStep = mongoose.model('RemediationStep', remediationStepSchema);

export default RemediationStep;
