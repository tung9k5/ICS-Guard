import mongoose from 'mongoose';
import { ROLES, VALID_ROLES } from '../constants/index.js';

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
    enum: VALID_ROLES,
    default: ROLES.CUSTOMER,
  },
  is_active: {
    type: Boolean,
    default: true,
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
  provider_type: {
    type: String,
    enum: ['local', 'google'],
    default: 'local',
  },
  provider_id: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

export default User;
