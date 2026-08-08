import mongoose from 'mongoose';

const ruleTemplateSchema = new mongoose.Schema({
  rule_name: { type: String, required: true, unique: true },
  description: { type: String },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'HIGH' },
  category: { type: String, default: 'ICS_PROTOCOL' },
  mitre_technique: { type: String, default: '' },
  time_window_seconds: { type: Number, default: 30 },
  trigger_count: { type: Number, default: 1 },
  conditions: [{
    field: { type: String },
    operator: { type: String },
    value: { type: mongoose.Schema.Types.Mixed }
  }],
  source_feed: { type: String, default: 'SigmaHQ / MITRE ATT&CK for ICS' },
  source_url: { type: String, default: '' },
  version: { type: String, default: 'v1.0' },
  is_official: { type: Boolean, default: true },
  last_synced_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const RuleTemplate = mongoose.model('RuleTemplate', ruleTemplateSchema);
export default RuleTemplate;
