import mongoose from 'mongoose';

const playbookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  trigger_rule: { type: String, required: true },
  actions: [{
    action_type: { type: String, enum: ['isolate_device', 'send_email', 'block_ip', 'shutdown_device'] },
    params: mongoose.Schema.Types.Mixed
  }],
  is_active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Playbook', playbookSchema);
