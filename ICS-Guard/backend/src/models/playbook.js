import mongoose from 'mongoose';

const actionSchema = new mongoose.Schema({
  action_type: {
    type: String,
    enum: ['isolate_device', 'send_email', 'block_ip', 'shutdown_device', 'notify_telegram', 'send_telegram'],
    required: true
  },
  params: { type: mongoose.Schema.Types.Mixed, default: {} },
  description: { type: String, default: '' },
}, { _id: false });

const playbookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  trigger_rule: { type: String, required: true },
  actions: [actionSchema],
  is_active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  // Tags for filtering and organization
  tags: [{ type: String }],
  // AI suggested flag
  suggested: { type: Boolean, default: false },
  // Statistics
  execution_count: { type: Number, default: 0 },
  last_executed_at: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('Playbook', playbookSchema);
