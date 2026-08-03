import connectDB from '../config/db.js';
import User from './user.js';
import Device from './device.js';
import AuditLog from './auditLog.js';
import BlockedIp from './blockedIp.js';
import RefreshToken from './refreshToken.js';
import Rule from './rule.js';
import Alert from './alert.js';
import Incident from './incident.js';
import IncidentTimeline from './incidentTimeline.js';
import Playbook from './playbook.js';
import SimulatorCommand from './simulatorCommand.js';
import OtPolicy from './otPolicy.js';
import SystemMetadata from './systemMetadata.js';

const db = {
  connectDB,
  User,
  Device,
  AuditLog,
  BlockedIp,
  RefreshToken,
  Rule,
  Alert,
  Incident,
  IncidentTimeline,
  Playbook,
  SimulatorCommand,
  OtPolicy,
  SystemMetadata,
};

export {
  connectDB,
  User,
  Device,
  AuditLog,
  BlockedIp,
  RefreshToken,
  Rule,
  Alert,
  Incident,
  IncidentTimeline,
  Playbook,
  SimulatorCommand,
  OtPolicy,
  SystemMetadata,
};

export default db;
