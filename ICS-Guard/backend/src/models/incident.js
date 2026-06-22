import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'investigating', 'remediated', 'closed'],
    default: 'open',
    index: true,
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'MEDIUM',
  },
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  alert_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
  }],
}, {
  timestamps: true,
});

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
