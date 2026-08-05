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
import RemediationSession from './remediationSession.js';
import RemediationStep from './remediationStep.js';
import RemediationActionLog from './remediationActionLog.js';
import RemediationCase from './remediationCase.js';

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
  RemediationSession,
  RemediationStep,
  RemediationActionLog,
  RemediationCase,
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
  RemediationSession,
  RemediationStep,
  RemediationActionLog,
  RemediationCase,
};

export default db;

