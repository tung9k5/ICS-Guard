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
    enum: ['admin', 'analyst', 'viewer'],
    default: 'viewer',
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
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);

export default User;
