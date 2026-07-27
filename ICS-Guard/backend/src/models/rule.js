import mongoose from 'mongoose';

const ruleSchema = new mongoose.Schema({
  rule_name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: {
    type: String,
    required: true,
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  severity: {
    type: String,
    enum: ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  conditions: [
    {
      field: String,
      operator: String,
      value: mongoose.Schema.Types.Mixed,
    }
  ],
  time_window_seconds: {
    type: Number,
    required: true,
  },
  trigger_count: {
    type: Number,
    required: true,
  },
  category: {
    type: String,
    enum: ['ICS_PROTOCOL', 'BEHAVIOR', 'NETWORK_SCAN', 'THREAT_INTEL', 'CUSTOM'],
    default: 'ICS_PROTOCOL',
  },
  mitre_technique: {
    type: String,
    default: '',
  },
  logic_nodes: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  group_by: [String],
  actions: [
    {
      action_type: String,
      config: mongoose.Schema.Types.Mixed,
    }
  ],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true,
});

const Rule = mongoose.model('Rule', ruleSchema);

export default Rule;
