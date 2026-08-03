import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  password_hash: {
    type: String,
    required: true,
    select: false,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  full_name: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['admin', 'hr_management', 'analyst', 'device_management'],
    default: 'analyst',
  },
  is_active: {
    type: Boolean,
    default: true,
  },
  status: {
    type: String,
    enum: ['active', 'pending', 'locked'],
    default: 'active',
  },
  deletion_pending: {
    type: Boolean,
    default: false,
  },
  deletion_requested_at: {
    type: Date,
    default: null,
  },
  deletion_expires_at: {
    type: Date,
    default: null,
  },
  deletion_requested_by: {
    type: String,
    default: null,
  },

  login_failures: {
    count: {
      type: Number,
      default: 0,
    },
    last_failed_at: {
      type: Date,
      default: null,
    },
    lockout_until: {
      type: Date,
      default: null,
    },
  },
  isFirstLogin: {
    type: Boolean,
    default: true,
  },
  contactInfo: {
    telegramChatId: {
      type: String,
      default: null,
    },
    telegramUsername: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
  },
  isAlertEnabled: {
    type: Boolean,
    default: true,
  },
  avatar: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

export default User;
