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
  forensics_artifacts: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['PCAP', 'PLC_REGISTER_DUMP', 'SYSLOG', 'SYSTEM_LOG'], default: 'PCAP' },
    size: { type: String, default: '0 KB' },
    size_bytes: { type: Number, default: 0 },
    sha256: { type: String, default: null },
    path: { type: String, default: null },
    filename: { type: String, default: null },
    download_url: { type: String, default: null },
    captured_at: { type: Date, default: Date.now }
  }],
}, {
  timestamps: true,
});

// Add TTL Index to automatically delete incidents older than 90 days (7776000 seconds)
incidentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
