import mongoose from 'mongoose';
import { SEVERITY_LEVELS } from '../constants/index.js';

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
    enum: Object.values(SEVERITY_LEVELS),
    default: SEVERITY_LEVELS.MEDIUM,
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
