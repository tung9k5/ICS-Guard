import mongoose from 'mongoose';
import { NOTIFICATION_TYPE, NOTIFICATION_SEVERITY } from '../constants/notification.constants.js';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: Object.values(NOTIFICATION_TYPE),
    required: true,
  },
  severity: {
    type: String,
    enum: Object.values(NOTIFICATION_SEVERITY),
    required: true,
  },
  deviceId: {
    type: String,
    ref: 'Device',
    default: null,
  },
  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Alert',
    default: null,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // If null, applies to all users with permission
  },
  isRead: {
    type: Boolean,
    default: false,
  }
}, { timestamps: true });

export default mongoose.model('Notification', notificationSchema);
