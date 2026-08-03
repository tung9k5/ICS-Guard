import mongoose from 'mongoose';

const otPolicySchema = new mongoose.Schema({
  policy_id: {
    type: String,
    required: true,
    default: 'ot-policy-main',
    index: true,
  },
  version: {
    type: Number,
    required: true,
    default: 1,
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'applied', 'failed'],
    default: 'draft',
  },
  default_action: {
    type: String,
    enum: ['allow', 'deny'],
    default: 'deny',
  },
  asset_zone_map: {
    type: Map,
    of: String,
    default: {},
  },
  rules: [{
    priority: { type: Number, required: true, default: 10 },
    source_zone: { type: String, default: null },
    destination_zone: { type: String, default: null },
    protocol: { type: String, default: null },
    port: { type: Number, default: null },
    action: { type: String, enum: ['allow', 'deny'], required: true, default: 'deny' },
  }],
  policy_hash: {
    type: String,
    default: '',
  },
  policy_apply_id: {
    type: String,
    default: null,
    index: true,
  },
  runtime_id: {
    type: String,
    default: 'hardware-01',
  },
  apply_expires_at: {
    type: Date,
    default: null,
  },
  applied_at: {
    type: Date,
    default: null,
  },
  runtime_ack: {
    type: Object,
    default: null,
  },
}, {
  timestamps: true,
});

const OtPolicy = mongoose.model('OtPolicy', otPolicySchema);

export default OtPolicy;
