import mongoose from 'mongoose';

const blockedIpSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  reason: {
    type: String,
    required: true,
  },
  blockedAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, {
  timestamps: false,
});

const BlockedIp = mongoose.model('BlockedIp', blockedIpSchema);

export default BlockedIp;
