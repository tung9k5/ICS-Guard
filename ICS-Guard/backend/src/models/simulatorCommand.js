import mongoose from 'mongoose';

const simulatorCommandSchema = new mongoose.Schema({
  command_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  command_type: {
    type: String,
    enum: ['isolate', 'rollback', 'policy'],
    required: true,
  },
  runtime_id: {
    type: String,
    default: 'hardware-01',
  },
  target_id: {
    type: String,
    required: true,
  },
  active_target: {
    type: String,
    default: undefined,
  },
  envelope_hash: {
    type: String,
    required: true,
  },
  previous_security_status: {
    type: String,
    default: 'normal',
  },
  requested_by: {
    type: String,
    default: 'system',
  },
  correlation: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'succeeded', 'failed', 'expired'],
    default: 'pending',
  },
  issued_at: {
    type: Date,
    default: Date.now,
  },
  expires_at: {
    type: Date,
    required: true,
  },
  executed_at: {
    type: Date,
    default: null,
  },
  final_ack: {
    type: Object,
    default: null,
  },
  // Defense Agent enforcement fields
  enforcement_mode: {
    type: String,
    enum: ['docker_network', 'iptables', 'tc_netem', 'simulated'],
    default: 'simulated',
  },
  enforcement_status: {
    type: String,
    enum: ['succeeded', 'failed', 'skipped'],
    default: 'skipped',
  },
  enforcement_applied_at: {
    type: Date,
    default: null,
  },
  confirmation_reason: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

simulatorCommandSchema.index(
  { active_target: 1 },
  { unique: true, sparse: true, name: 'one_active_command_per_target' }
);
simulatorCommandSchema.index(
  { 'correlation.incident_id': 1, issued_at: 1 },
  { sparse: true, name: 'incident_command_timeline' }
);

const SimulatorCommand = mongoose.model('SimulatorCommand', simulatorCommandSchema);

export default SimulatorCommand;
