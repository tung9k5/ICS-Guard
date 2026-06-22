import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  username: {
    type: String,
    default: 'System',
  },
  action: {
    type: String,
    required: true,
  },
  target_resource: {
    type: String,
    default: '',
  },
  ipAddress: {
    type: String,
    default: 'Internal',
  },
  ip_address: {
    type: String,
    default: 'Internal',
  },
  userAgent: {
    type: String,
    default: '',
  },
  user_agent: {
    type: String,
    default: '',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['SUCCESS', 'FAILED'],
    default: 'SUCCESS',
  },
}, {
  timestamps: true,
  updatedAt: false, // Audit logs are immutable, only createdAt/timestamp is needed
});

// Sync camelCase and snake_case fields on save
auditLogSchema.pre('save', function (next) {
  if (this.ipAddress && !this.ip_address) this.ip_address = this.ipAddress;
  if (this.ip_address && !this.ipAddress) this.ipAddress = this.ip_address;
  if (this.userAgent && !this.user_agent) this.user_agent = this.userAgent;
  if (this.user_agent && !this.userAgent) this.userAgent = this.user_agent;
  next();
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
