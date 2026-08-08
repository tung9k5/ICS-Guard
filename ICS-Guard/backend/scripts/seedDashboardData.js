import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import {
  User,
  Device,
  Rule,
  Alert,
  Incident,
  IncidentTimeline,
  AuditLog,
  BlockedIp,
} from '../src/models/index.js';

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/ics_guard';
const SEED_PREFIX = 'DASH-SEED';
const PASSWORD = process.env.DASHBOARD_SEED_PASSWORD || 'Demo@12345';

const hoursAgo = hours => new Date(Date.now() - hours * 60 * 60 * 1000);
const daysAgoAt = (days, hour, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const usersSeed = [
  { username: 'dash_admin', email: 'dash_admin@ics-guard.local', full_name: 'Dashboard SOC Admin', role: 'admin' },
  { username: 'dash_analyst', email: 'dash_analyst@ics-guard.local', full_name: 'Dashboard SOC Analyst', role: 'analyst' },
  { username: 'dash_device_manager', email: 'dash_device_manager@ics-guard.local', full_name: 'Dashboard Device Manager', role: 'device_management' },
];

const rulesSeed = [
  {
    rule_name: 'DASH_MODBUS_WRITE_SPIKE',
    description: 'Detects abnormal Modbus function-code write bursts against PLC or RTU assets.',
    severity: 'HIGH',
    category: 'ICS_PROTOCOL',
    mitre_technique: 'T0831 - Manipulation of Control',
    conditions: [
      { field: 'protocol', operator: 'equals', value: 'modbus' },
      { field: 'function_code', operator: 'in', value: [5, 6, 15, 16] },
      { field: 'event_count', operator: '>=', value: 25 },
    ],
    time_window_seconds: 60,
    trigger_count: 5,
  },
  {
    rule_name: 'DASH_SENSOR_DRIFT_PRESSURE',
    description: 'Detects pressure telemetry drift outside the device baseline window.',
    severity: 'MEDIUM',
    category: 'BEHAVIOR',
    mitre_technique: 'T0806 - Brute Force I/O',
    conditions: [
      { field: 'telemetry.pressure_bar', operator: '>', value: 8.4 },
      { field: 'baseline.deviation_percent', operator: '>=', value: 18 },
    ],
    time_window_seconds: 300,
    trigger_count: 3,
  },
  {
    rule_name: 'DASH_UNAUTHORIZED_ENGINEERING_STATION',
    description: 'Detects engineering workstation access from an untrusted source segment.',
    severity: 'CRITICAL',
    category: 'NETWORK_SCAN',
    mitre_technique: 'T0842 - Network Sniffing',
    conditions: [
      { field: 'source_ip', operator: 'not_in_cidr', value: ['192.168.10.0/24', '192.168.20.0/24'] },
      { field: 'destination_port', operator: 'in', value: [102, 502, 44818] },
    ],
    time_window_seconds: 120,
    trigger_count: 1,
  },
  {
    rule_name: 'DASH_GATEWAY_TRAFFIC_SURGE',
    description: 'Detects sustained traffic above the gateway baseline for OT zone gateways.',
    severity: 'HIGH',
    category: 'BEHAVIOR',
    mitre_technique: 'T0814 - Denial of Service',
    conditions: [
      { field: 'metrics.bytes_per_second', operator: '>', value: 42000 },
      { field: 'metrics.connection_rate', operator: '>', value: 35 },
    ],
    time_window_seconds: 180,
    trigger_count: 4,
  },
  {
    rule_name: 'DASH_SAFETY_ACTUATOR_OFFLINE',
    description: 'Detects critical actuator or breaker assets that stop sending heartbeats.',
    severity: 'CRITICAL',
    category: 'ICS_PROTOCOL',
    mitre_technique: 'T0881 - Service Stop',
    conditions: [
      { field: 'heartbeat_age_seconds', operator: '>', value: 90 },
      { field: 'asset_class', operator: 'in', value: ['pump', 'breaker', 'actuator'] },
    ],
    time_window_seconds: 180,
    trigger_count: 2,
  },
];

const devicesSeed = [
  {
    _id: 'DASH-SEED-WATER-GW-01', name: 'Water Zone Gateway 01', node_type: 'gateway', type: 'Industrial Gateway', zone: 'Zone-A',
    ipAddress: '192.168.10.1', macAddress: '02:42:0A:00:10:01', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 22, purdue_level: 'L3', hardware_model: 'Moxa EDR-G903', firmware_version: '5.7.2', icon_path: 'Network',
    baseline_metrics: { bytes_per_second_max: 36000, connection_rate_max: 24 }, description: 'Primary gateway for water treatment OT segment.',
  },
  {
    _id: 'DASH-SEED-WATER-PLC-01', name: 'PLC Chlorine Dosing 01', node_type: 'controller', type: 'PLC Controller', zone: 'Zone-A', parent_id: 'DASH-SEED-WATER-GW-01',
    ipAddress: '192.168.10.11', macAddress: '02:42:0A:00:10:0B', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 74, purdue_level: 'L1', hardware_model: 'Siemens S7-1200 CPU 1214C', firmware_version: '4.5.1', icon_path: 'Cpu',
    baseline_metrics: { bytes_per_second_max: 22000, connection_rate_max: 18 }, description: 'Controls chlorine dosing pumps and safety interlocks.',
  },
  {
    _id: 'DASH-SEED-WATER-PRESSURE-01', name: 'Pressure Sensor Intake 01', node_type: 'sensor_pressure', type: 'Pressure Sensor', zone: 'Zone-A', parent_id: 'DASH-SEED-WATER-PLC-01',
    ipAddress: '192.168.10.21', macAddress: '02:42:0A:00:10:15', status: 'online', operational_status: 'online', security_status: 'normal',
    risk_score: 39, purdue_level: 'L0', hardware_model: 'Endress+Hauser Cerabar PMP51', firmware_version: '2.3.8', icon_path: 'Gauge',
    baseline_metrics: { bytes_per_second_max: 8000, connection_rate_max: 8 }, description: 'Monitors intake pressure before filtration.',
  },
  {
    _id: 'DASH-SEED-WATER-PUMP-01', name: 'Raw Water Pump 01', node_type: 'pump', type: 'Pump Actuator', zone: 'Zone-A', parent_id: 'DASH-SEED-WATER-PLC-01',
    ipAddress: '192.168.10.31', macAddress: '02:42:0A:00:10:1F', status: 'isolated', operational_status: 'active', security_status: 'isolated',
    risk_score: 88, purdue_level: 'L0', hardware_model: 'Grundfos CR 64-2', firmware_version: '1.9.4', icon_path: 'Droplets',
    baseline_metrics: { bytes_per_second_max: 12000, connection_rate_max: 10 }, description: 'Temporarily isolated after suspicious write command burst.',
  },
  {
    _id: 'DASH-SEED-POWER-GW-01', name: 'Power Zone Gateway 01', node_type: 'gateway', type: 'Industrial Gateway', zone: 'Zone-B',
    ipAddress: '192.168.20.1', macAddress: '02:42:0A:00:20:01', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 18, purdue_level: 'L3', hardware_model: 'Hirschmann Eagle40', firmware_version: '6.2.1', icon_path: 'Network',
    baseline_metrics: { bytes_per_second_max: 41000, connection_rate_max: 28 }, description: 'Primary gateway for electrical distribution segment.',
  },
  {
    _id: 'DASH-SEED-POWER-RTU-01', name: 'Substation RTU Feeder A', node_type: 'rtu', type: 'Remote Terminal Unit', zone: 'Zone-B', parent_id: 'DASH-SEED-POWER-GW-01',
    ipAddress: '192.168.20.12', macAddress: '02:42:0A:00:20:0C', status: 'offline', operational_status: 'offline', security_status: 'reconciliation_required',
    risk_score: 57, purdue_level: 'L1', hardware_model: 'Schneider SCADAPack 474', firmware_version: '8.14.3', icon_path: 'GitMerge',
    baseline_metrics: { bytes_per_second_max: 18000, connection_rate_max: 12 }, description: 'Offline after redundant link failover; requires operator check.',
  },
  {
    _id: 'DASH-SEED-POWER-BREAKER-01', name: 'Breaker Controller A1', node_type: 'breaker', type: 'Breaker Controller', zone: 'Zone-B', parent_id: 'DASH-SEED-POWER-RTU-01',
    ipAddress: '192.168.20.33', macAddress: '02:42:0A:00:20:21', status: 'quarantined', operational_status: 'active', security_status: 'isolated',
    risk_score: 93, purdue_level: 'L0', hardware_model: 'SEL-751 Feeder Protection Relay', firmware_version: 'R411-V0', icon_path: 'Zap',
    baseline_metrics: { bytes_per_second_max: 9000, connection_rate_max: 7 }, description: 'Quarantined due to unauthorized engineering station access.',
  },
  {
    _id: 'DASH-SEED-HVAC-GW-01', name: 'HVAC Zone Gateway 01', node_type: 'gateway', type: 'Industrial Gateway', zone: 'Zone-C',
    ipAddress: '192.168.30.1', macAddress: '02:42:0A:00:30:01', status: 'online', operational_status: 'online', security_status: 'normal',
    risk_score: 16, purdue_level: 'L3', hardware_model: 'Cisco IE-3400', firmware_version: '17.9.4', icon_path: 'Network',
    baseline_metrics: { bytes_per_second_max: 30000, connection_rate_max: 20 }, description: 'HVAC aggregation gateway.',
  },
  {
    _id: 'DASH-SEED-HVAC-DCS-01', name: 'Chiller DCS Controller 01', node_type: 'dcs', type: 'DCS Controller', zone: 'Zone-C', parent_id: 'DASH-SEED-HVAC-GW-01',
    ipAddress: '192.168.30.14', macAddress: '02:42:0A:00:30:0E', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 43, purdue_level: 'L1', hardware_model: 'Honeywell C300', firmware_version: 'R511.2', icon_path: 'BrainCircuit',
    baseline_metrics: { bytes_per_second_max: 21000, connection_rate_max: 16 }, description: 'Coordinates chiller loops for datacenter cooling.',
  },
  {
    _id: 'DASH-SEED-HVAC-TEMP-01', name: 'Temperature Sensor CRAC 01', node_type: 'sensor', type: 'Temperature Sensor', zone: 'Zone-C', parent_id: 'DASH-SEED-HVAC-DCS-01',
    ipAddress: '192.168.30.24', macAddress: '02:42:0A:00:30:18', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 27, purdue_level: 'L0', hardware_model: 'Siemens QAE2121.010', firmware_version: '1.4.0', icon_path: 'Thermometer',
    baseline_metrics: { bytes_per_second_max: 7000, connection_rate_max: 7 }, description: 'CRAC room supply temperature sensor.',
  },
  {
    _id: 'DASH-SEED-HVAC-FAN-01', name: 'Cooling Fan Motor 01', node_type: 'motor', type: 'Motor Drive', zone: 'Zone-C', parent_id: 'DASH-SEED-HVAC-DCS-01',
    ipAddress: '192.168.30.35', macAddress: '02:42:0A:00:30:23', status: 'active', operational_status: 'active', security_status: 'normal',
    risk_score: 31, purdue_level: 'L0', hardware_model: 'ABB ACS580 Drive', firmware_version: '2.8.5', icon_path: 'Wind',
    baseline_metrics: { bytes_per_second_max: 9500, connection_rate_max: 8 }, description: 'Variable speed fan motor drive.',
  },
];

const alertPlans = [
  { device_id: 'DASH-SEED-WATER-PUMP-01', rule: 'DASH_MODBUS_WRITE_SPIKE', severity: 'CRITICAL', status: 'new', event_count: 42, source_ip: '10.70.14.23', detected: hoursAgo(2), title: 'Unauthorized Modbus write burst against raw water pump' },
  { device_id: 'DASH-SEED-POWER-BREAKER-01', rule: 'DASH_UNAUTHORIZED_ENGINEERING_STATION', severity: 'CRITICAL', status: 'acknowledged', event_count: 7, source_ip: '172.16.55.19', detected: hoursAgo(7), title: 'Engineering workstation access from untrusted segment' },
  { device_id: 'DASH-SEED-POWER-RTU-01', rule: 'DASH_SAFETY_ACTUATOR_OFFLINE', severity: 'HIGH', status: 'acknowledged', event_count: 12, source_ip: '192.168.20.12', detected: hoursAgo(12), title: 'RTU feeder telemetry heartbeat loss' },
  { device_id: 'DASH-SEED-WATER-PRESSURE-01', rule: 'DASH_SENSOR_DRIFT_PRESSURE', severity: 'MEDIUM', status: 'resolved', event_count: 18, source_ip: '192.168.10.21', detected: hoursAgo(22), title: 'Pressure telemetry drift outside baseline' },
  { device_id: 'DASH-SEED-WATER-GW-01', rule: 'DASH_GATEWAY_TRAFFIC_SURGE', severity: 'HIGH', status: 'resolved', event_count: 31, source_ip: '10.70.14.23', detected: daysAgoAt(1, 10, 15), title: 'Zone-A gateway traffic surge' },
  { device_id: 'DASH-SEED-HVAC-DCS-01', rule: 'DASH_GATEWAY_TRAFFIC_SURGE', severity: 'MEDIUM', status: 'resolved', event_count: 15, source_ip: '192.168.30.44', detected: daysAgoAt(2, 14, 30), title: 'Chiller DCS polling rate anomaly' },
  { device_id: 'DASH-SEED-HVAC-TEMP-01', rule: 'DASH_SENSOR_DRIFT_PRESSURE', severity: 'LOW', status: 'resolved', event_count: 4, source_ip: '192.168.30.24', detected: daysAgoAt(3, 3, 20), title: 'Temperature sensor baseline drift warning' },
  { device_id: 'DASH-SEED-WATER-PLC-01', rule: 'DASH_MODBUS_WRITE_SPIKE', severity: 'HIGH', status: 'resolved', event_count: 27, source_ip: '10.70.14.23', detected: daysAgoAt(4, 17, 45), title: 'PLC coil write burst detected' },
  { device_id: 'DASH-SEED-HVAC-FAN-01', rule: 'DASH_SAFETY_ACTUATOR_OFFLINE', severity: 'MEDIUM', status: 'resolved', event_count: 9, source_ip: '192.168.30.35', detected: daysAgoAt(5, 21, 5), title: 'Fan motor heartbeat jitter' },
  { device_id: 'DASH-SEED-POWER-GW-01', rule: 'DASH_GATEWAY_TRAFFIC_SURGE', severity: 'LOW', status: 'false_positive', event_count: 6, source_ip: '192.168.20.44', detected: daysAgoAt(6, 8, 40), title: 'Scheduled maintenance traffic exceeded warning threshold' },
];

const incidentPlans = [
  { alertIndex: 0, status: 'open', severity: 'CRITICAL', assigned: 'dash_analyst', createdAt: hoursAgo(2), title: 'IR-2401 Raw water pump command manipulation', description: 'Correlated Modbus write burst and pump isolation on Zone-A raw water line.' },
  { alertIndex: 1, status: 'investigating', severity: 'CRITICAL', assigned: 'dash_analyst', createdAt: hoursAgo(7), title: 'IR-2402 Unauthorized engineering access to feeder breaker', description: 'Untrusted source reached engineering ports on breaker controller A1.' },
  { alertIndex: 2, status: 'investigating', severity: 'HIGH', assigned: 'dash_device_manager', createdAt: hoursAgo(12), title: 'IR-2403 Substation RTU heartbeat outage', description: 'RTU feeder stopped telemetry after redundant path failover.' },
  { alertIndex: 3, status: 'closed', severity: 'MEDIUM', assigned: 'dash_analyst', createdAt: hoursAgo(22), title: 'IR-2404 Intake pressure drift review', description: 'Pressure values exceeded baseline but were confirmed as process surge.' },
  { alertIndex: 4, status: 'closed', severity: 'HIGH', assigned: 'dash_analyst', createdAt: daysAgoAt(1, 10, 20), title: 'IR-2405 Zone-A gateway traffic surge', description: 'Gateway traffic surge caused by temporary historian backfill.' },
  { alertIndex: 5, status: 'closed', severity: 'MEDIUM', assigned: 'dash_analyst', createdAt: daysAgoAt(2, 14, 35), title: 'IR-2406 Chiller DCS polling anomaly', description: 'HVAC polling increase reviewed and resolved.' },
  { alertIndex: 6, status: 'closed', severity: 'LOW', assigned: 'dash_device_manager', createdAt: daysAgoAt(3, 3, 25), title: 'IR-2407 Temperature sensor drift warning', description: 'Sensor calibration drift noted for next maintenance window.' },
  { alertIndex: 7, status: 'closed', severity: 'HIGH', assigned: 'dash_analyst', createdAt: daysAgoAt(4, 17, 50), title: 'IR-2408 PLC write burst historical review', description: 'Previous write burst traced to approved commissioning test.' },
  { alertIndex: 8, status: 'closed', severity: 'MEDIUM', assigned: 'dash_device_manager', createdAt: daysAgoAt(5, 21, 10), title: 'IR-2409 Cooling fan heartbeat jitter', description: 'Network jitter from maintenance switch caused delayed heartbeats.' },
  { alertIndex: 9, status: 'closed', severity: 'LOW', assigned: 'dash_analyst', createdAt: daysAgoAt(6, 8, 45), title: 'IR-2410 Power gateway maintenance traffic false positive', description: 'False positive during scheduled relay firmware audit.' },
];

const timelineForIncident = (incident, alert, actor) => {
  const created = new Date(incident.createdAt);
  const plusMinutes = minutes => new Date(created.getTime() + minutes * 60 * 1000);
  const rows = [
    {
      incident_id: incident._id,
      event_time: created,
      actor: 'rule-engine',
      action_type: 'incident_created',
      description: `Incident created from ${alert.rule_name} on ${alert.device_id}.`,
      metadata: { alert_id: alert._id, severity: incident.severity, status: incident.status },
    },
    {
      incident_id: incident._id,
      event_time: plusMinutes(8),
      actor,
      action_type: 'manual_note',
      description: `SOC analyst reviewed source ${alert.source_ip} and validated affected asset ${alert.device_id}.`,
      metadata: { event_count: alert.event_count, source_ip: alert.source_ip },
    },
  ];

  if (['open', 'investigating'].includes(incident.status)) {
    rows.push({
      incident_id: incident._id,
      event_time: plusMinutes(14),
      actor: 'soar-engine',
      action_type: 'containment_triggered',
      description: incident.severity === 'CRITICAL'
        ? 'Containment workflow prepared; operator confirmation required before isolation.'
        : 'Containment checklist opened for operator review.',
      metadata: {
        command_type: incident.severity === 'CRITICAL' ? 'isolate' : 'investigate',
        status: incident.severity === 'CRITICAL' ? 'pending' : 'accepted',
        target_id: alert.device_id,
      },
    });
  } else {
    rows.push({
      incident_id: incident._id,
      event_time: plusMinutes(26),
      actor,
      action_type: 'status_change',
      description: 'Incident verified, documented, and closed after traffic returned to baseline.',
      metadata: { from: 'investigating', to: 'closed', verification: 'traffic_normal' },
    });
  }

  return rows;
};

async function cleanupDemoData() {
  const demoDevices = devicesSeed.map(device => device._id);
  const demoRules = rulesSeed.map(rule => rule.rule_name);
  const demoUsers = usersSeed.map(user => user.username);
  const demoAlertTitles = alertPlans.map(alert => alert.title);
  const demoIncidentTitles = incidentPlans.map(incident => incident.title);

  const oldAlerts = await Alert.find({
    $or: [
      { device_id: { $in: demoDevices } },
      { rule_name: { $in: demoRules } },
      { title: { $in: demoAlertTitles } },
    ],
  }, '_id incident_id');

  const oldIncidentIds = oldAlerts.map(alert => alert.incident_id).filter(Boolean);
  const oldIncidents = await Incident.find({
    $or: [
      { _id: { $in: oldIncidentIds } },
      { title: { $in: demoIncidentTitles } },
    ],
  }, '_id');

  await IncidentTimeline.deleteMany({ incident_id: { $in: oldIncidents.map(item => item._id) } });
  await Incident.deleteMany({ _id: { $in: oldIncidents.map(item => item._id) } });
  await Alert.deleteMany({ _id: { $in: oldAlerts.map(item => item._id) } });
  await Rule.deleteMany({ rule_name: { $in: demoRules } });
  await Device.deleteMany({ _id: { $in: demoDevices } });
  await AuditLog.deleteMany({ username: { $in: demoUsers } });
  await BlockedIp.deleteMany({ reason: new RegExp(SEED_PREFIX) });
  await User.deleteMany({ username: { $in: demoUsers } });
}

async function seedUsers() {
  const password_hash = await bcrypt.hash(PASSWORD, 10);
  const users = await User.insertMany(usersSeed.map(seed => ({
    ...seed,
    password_hash,
    is_active: true,
    status: 'active',
    isFirstLogin: false,
    isAlertEnabled: true,
    contactInfo: {
      telegramChatId: seed.role === 'admin' ? '1000000001' : null,
      telegramUsername: seed.username,
      phoneNumber: '+84000000000',
    },
  })));
  return Object.fromEntries(users.map(user => [user.username, user]));
}

async function seedRules(usersByName) {
  return Rule.insertMany(rulesSeed.map(rule => ({
    ...rule,
    is_active: true,
    created_by: usersByName.dash_admin._id,
    actions: [
      { action_type: 'create_incident', config: { assign_to_role: 'analyst' } },
      { action_type: 'notify', config: { channel: 'dashboard' } },
    ],
    group_by: ['device_id', 'source_ip'],
  })));
}

async function seedDevices(usersByName) {
  return Device.insertMany(devicesSeed.map(device => ({
    ...device,
    ip_address: device.ipAddress,
    mac_address: device.macAddress,
    userId: usersByName.dash_device_manager._id,
    approval_status: 'approved',
    approved_by: usersByName.dash_admin.username,
    approved_at: hoursAgo(72),
    commissioned_date: daysAgoAt(180, 9),
    source_id: 'dashboard-seed',
    source_type: 'seed-script',
    api_key: `${device._id}-api-key`,
    lastSeen: device.status === 'offline' ? hoursAgo(3) : hoursAgo(0.2),
  })));
}

async function seedAlerts() {
  const alerts = [];
  for (const plan of alertPlans) {
    const alert = await Alert.create({
      rule_name: plan.rule,
      device_id: plan.device_id,
      title: plan.title,
      description: `${plan.title}. Source ${plan.source_ip} generated ${plan.event_count} correlated OT events.`,
      severity: plan.severity,
      status: plan.status,
      source_ip: plan.source_ip,
      destination_ip: devicesSeed.find(device => device._id === plan.device_id)?.ipAddress,
      event_count: plan.event_count,
      detected_at: plan.detected,
      createdAt: plan.detected,
      updatedAt: plan.detected,
      raw_events_sample: [
        { timestamp: plan.detected, message: `${plan.rule}: first correlated event for ${plan.device_id}` },
        { timestamp: new Date(plan.detected.getTime() + 45 * 1000), message: `${plan.rule}: threshold exceeded with count=${plan.event_count}` },
      ],
      ai_provenance: {
        model_id: 'ics-guard-seed-risk-v1',
        algorithm: 'rule-correlation-baseline',
        feature_schema_version: '2026.08',
        score: plan.severity === 'CRITICAL' ? 0.94 : plan.severity === 'HIGH' ? 0.82 : 0.61,
        confidence: plan.severity === 'LOW' ? 0.68 : 0.86,
        inference_at: plan.detected,
      },
    });
    alerts.push(alert);
  }
  return alerts;
}

async function seedIncidents(alerts, usersByName) {
  const incidents = [];
  for (const plan of incidentPlans) {
    const alert = alerts[plan.alertIndex];
    const assignedUser = usersByName[plan.assigned] || usersByName.dash_analyst;
    const incident = await Incident.create({
      title: plan.title,
      description: plan.description,
      status: plan.status,
      severity: plan.severity,
      assigned_to: assignedUser._id,
      alert_ids: [alert._id],
      createdAt: plan.createdAt,
      updatedAt: plan.status === 'closed' ? new Date(plan.createdAt.getTime() + 55 * 60 * 1000) : hoursAgo(0.1),
      forensics_artifacts: [
        {
          name: `${alert.device_id} packet capture`,
          type: 'PCAP',
          size: plan.severity === 'CRITICAL' ? '18.4 MB' : '6.2 MB',
          size_bytes: plan.severity === 'CRITICAL' ? 18400000 : 6200000,
          sha256: `${alert._id.toString().padEnd(64, '0').slice(0, 64)}`,
          filename: `${plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pcap`,
          download_url: `/api/incidents/${alert._id}/pcap`,
          captured_at: plan.createdAt,
        },
      ],
    });

    alert.incident_id = incident._id;
    alert.status = plan.status === 'closed' ? 'resolved' : alert.status;
    if (plan.status === 'closed') {
      alert.resolved_at = incident.updatedAt;
      alert.resolved_by = assignedUser.username;
    }
    await alert.save();

    const timelineRows = timelineForIncident(incident, alert, assignedUser.username);
    await IncidentTimeline.insertMany(timelineRows);
    incidents.push(incident);
  }
  return incidents;
}

async function seedAuditAndBlockedIps(usersByName) {
  await AuditLog.insertMany([
    { userId: usersByName.dash_admin._id, username: 'dash_admin', action: 'SEED_DASHBOARD_DATA', target_resource: 'Dashboard', status: 'SUCCESS', ipAddress: '127.0.0.1', userAgent: 'seed-script' },
    { userId: usersByName.dash_analyst._id, username: 'dash_analyst', action: 'ACKNOWLEDGE_INCIDENT', target_resource: 'IR-2402', status: 'SUCCESS', ipAddress: '192.168.10.50', userAgent: 'seed-script' },
    { userId: usersByName.dash_device_manager._id, username: 'dash_device_manager', action: 'UPDATE_DEVICE_STATUS', target_resource: 'DASH-SEED-POWER-RTU-01', status: 'SUCCESS', ipAddress: '192.168.20.50', userAgent: 'seed-script' },
  ]);

  await BlockedIp.insertMany([
    { ipAddress: '10.70.14.23', reason: `${SEED_PREFIX}: repeated Modbus write attempts against Zone-A`, blockedBy: usersByName.dash_admin._id, expiresAt: daysAgoAt(-2, 9) },
    { ipAddress: '172.16.55.19', reason: `${SEED_PREFIX}: untrusted engineering workstation scan`, blockedBy: usersByName.dash_admin._id, expiresAt: daysAgoAt(-1, 18) },
  ]);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log(`[dashboard-seed] Connected to MongoDB: ${MONGODB_URI.replace(/:([^:@]+)@/, ':****@')}`);

  await cleanupDemoData();
  console.log('[dashboard-seed] Removed previous dashboard seed data.');

  const usersByName = await seedUsers();
  const rules = await seedRules(usersByName);
  const devices = await seedDevices(usersByName);
  const alerts = await seedAlerts();
  const incidents = await seedIncidents(alerts, usersByName);
  await seedAuditAndBlockedIps(usersByName);

  const activeDevices = devices.filter(device => ['active', 'online'].includes(device.status)).length;
  const warningDevices = devices.filter(device => ['inactive', 'offline'].includes(device.status)).length;
  const criticalDevices = devices.filter(device => ['isolated', 'quarantined'].includes(device.status)).length;
  const averageRisk = Math.round((devices.reduce((sum, device) => sum + device.risk_score, 0) / devices.length) * 10) / 10;

  console.log('[dashboard-seed] Seed completed.');
  console.log(`[dashboard-seed] Users: ${Object.keys(usersByName).length}`);
  console.log(`[dashboard-seed] Devices: ${devices.length} (healthy=${activeDevices}, warning=${warningDevices}, critical=${criticalDevices})`);
  console.log(`[dashboard-seed] Rules: ${rules.length}`);
  console.log(`[dashboard-seed] Alerts: ${alerts.length}`);
  console.log(`[dashboard-seed] Incidents: ${incidents.length} across last 7 days`);
  console.log(`[dashboard-seed] Average risk score: ${averageRisk}`);
  console.log(`[dashboard-seed] Demo login: dash_admin / ${PASSWORD}`);
}

main()
  .catch(error => {
    console.error('[dashboard-seed] Failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
