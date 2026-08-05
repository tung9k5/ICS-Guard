import mongoose from 'mongoose';
import {
  REMEDIATION_CASE_OUTCOMES,
} from '../constants/index.js';

const remediationCaseSchema = new mongoose.Schema({
  incident_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Incident',
    required: true,
    index: true,
  },
  created_from_session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RemediationSession',
    required: true,
    index: true,
  },
  incident_type: {
    type: String,
    default: 'unknown',
    index: true,
  },
  signal_signature: [{
    type: String,
    index: true,
  }],
  signal_snapshot: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  diagnosis: {
    type: String,
    default: '',
  },
  suspected_cause: {
    type: String,
    default: '',
    index: true,
  },
  solution_summary: {
    type: String,
    default: '',
  },
  successful_steps: [{
    type: mongoose.Schema.Types.Mixed,
  }],
  failed_steps: [{
    type: mongoose.Schema.Types.Mixed,
  }],
  outcome: {
    type: String,
    enum: Object.values(REMEDIATION_CASE_OUTCOMES),
    default: REMEDIATION_CASE_OUTCOMES.SUCCESS,
    index: true,
  },
  reuse_count: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

remediationCaseSchema.index({ incident_type: 1, outcome: 1, createdAt: -1 });
remediationCaseSchema.index({ suspected_cause: 1, outcome: 1, createdAt: -1 });

const RemediationCase = mongoose.model('RemediationCase', remediationCaseSchema);

export default RemediationCase;
