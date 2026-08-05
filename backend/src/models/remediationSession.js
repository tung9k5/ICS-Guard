import mongoose from 'mongoose';
import {
  REMEDIATION_PLAN_STATUSES,
  REMEDIATION_SESSION_SOURCES,
  REMEDIATION_DEFAULT_AUTO_THRESHOLD,
  SEVERITY_LEVELS,
} from '../constants/index.js';

const remediationSessionSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
    index: true,
  },
  source: {
    type: String,
    enum: Object.values(REMEDIATION_SESSION_SOURCES),
    default: REMEDIATION_SESSION_SOURCES.AI,
    index: true,
  },
  status: {
    type: String,
    enum: Object.values(REMEDIATION_PLAN_STATUSES),
    default: REMEDIATION_PLAN_STATUSES.DRAFT,
    index: true,
  },
  diagnosis_summary: {
    type: String,
    default: '',
  },
  suspected_cause: {
    type: String,
    default: '',
    index: true,
  },
  risk_level: {
    type: String,
    enum: Object.values(SEVERITY_LEVELS),
    default: SEVERITY_LEVELS.MEDIUM,
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0,
  },
  signal_snapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  manual_fault_type: {
    type: String,
    default: null,
    index: true,
  },
  ai_model: {
    type: String,
    default: null,
  },
  ai_raw_response: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  auto_eligible: {
    type: Boolean,
    default: false,
    index: true,
  },
  auto_evidence: {
    similar_case_count: { type: Number, default: 0 },
    threshold: { type: Number, default: REMEDIATION_DEFAULT_AUTO_THRESHOLD },
    matched_case_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RemediationCase' }],
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updated_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  outcome: {
    success: { type: Boolean, default: null },
    summary: { type: String, default: '' },
    completed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    completed_at: { type: Date, default: null },
  },
}, {
  timestamps: true,
});

remediationSessionSchema.index({ incident_id: 1, createdAt: -1 });
remediationSessionSchema.index({ suspected_cause: 1, status: 1 });

const RemediationSession = mongoose.model('RemediationSession', remediationSessionSchema);

export default RemediationSession;
