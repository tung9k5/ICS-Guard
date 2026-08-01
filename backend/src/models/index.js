import connectDB from '../config/db.js';
import User from './user.js';
import Device from './device.js';
import DeviceSensor from './deviceSensor.js';
import AuditLog from './auditLog.js';
import BlockedIp from './blockedIp.js';
import RefreshToken from './refreshToken.js';
import Rule from './rule.js';
import Alert from './alert.js';
import Incident from './incident.js';
import IncidentTimeline from './incidentTimeline.js';
import Setting from './Setting.js';
import IdSequence from './IdSequence.js';

const db = {
  connectDB,
  User,
  Device,
  DeviceSensor,
  AuditLog,
  BlockedIp,
  RefreshToken,
  Rule,
  Alert,
  Incident,
  IncidentTimeline,
  Setting,
  IdSequence,
};

export {
  connectDB,
  User,
  Device,
  DeviceSensor,
  AuditLog,
  BlockedIp,
  RefreshToken,
  Rule,
  Alert,
  Incident,
  IncidentTimeline,
  Setting,
  IdSequence,
};

export default db;
