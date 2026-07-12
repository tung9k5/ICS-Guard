import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import db from '../src/models/index.js';
const { User, Device, Alert, Incident, Rule, AuditLog, IncidentTimeline, BlockedIp } = db;

const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27018/ics-guard';

async function seedDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data (optional, uncomment if you want a fresh start)
    await User.deleteMany();
    await Device.deleteMany();
    await Alert.deleteMany();
    await Incident.deleteMany();
    await Rule.deleteMany();
    await AuditLog.deleteMany();
    await IncidentTimeline.deleteMany();
    await BlockedIp.deleteMany();

    // 1. Seed Users (5 users corresponding to 5 roles)
    const roles = ['admin', 'l1_analyst', 'l2_responder', 'l3_manager', 'ot_operator'];
    const users = [];
    for (let i = 0; i < roles.length; i++) {
      const user = new User({
        username: `${roles[i]}_user`,
        password_hash: await bcrypt.hash('password123', 10),
        email: `${roles[i]}@ics-guard.com`,
        full_name: `${roles[i].replace('_', ' ').toUpperCase()} User`,
        role: roles[i],
        is_active: true
      });
      await user.save();
      users.push(user);
    }
    console.log(`Created 5 users.`);

    // 2. Seed Devices (15 devices)
    const devices = [];
    const nodeTypes = ['gateway', 'controller', 'chip', 'sensor', 'actuator'];
    const statuses = ['active', 'isolated', 'online', 'quarantined'];
    for (let i = 1; i <= 15; i++) {
      const device = new Device({
        _id: `DEV-${1000 + i}`,
        name: `ICS Device ${i}`,
        type: i % 3 === 0 ? 'PLC' : (i % 2 === 0 ? 'HMI' : 'IoT Sensor'),
        zone: `Zone-${['A', 'B', 'C'][i % 3]}`,
        ipAddress: `192.168.10.${10 + i}`,
        macAddress: `00:1A:2B:3C:4D:${(10 + i).toString(16).padStart(2, '0').toUpperCase()}`,
        status: statuses[i % statuses.length],
        risk_score: Math.floor(Math.random() * 100),
        node_type: nodeTypes[i % nodeTypes.length],
        userId: users[i % users.length]._id
      });
      await device.save();
      devices.push(device);
    }
    console.log(`Created 15 devices.`);

    // 3. Seed Rules (15 rules)
    const rules = [];
    const severities = ['INFO', 'MEDIUM', 'HIGH', 'CRITICAL'];
    for (let i = 1; i <= 15; i++) {
      const rule = new Rule({
        rule_name: `Detection Rule ${i}`,
        description: `Rule description for detecting anomalies type ${i}`,
        severity: severities[i % severities.length],
        is_active: true,
        time_window_seconds: 60,
        trigger_count: 5,
        created_by: users[0]._id,
        conditions: [{ field: 'risk_score', operator: '>', value: 50 + i }]
      });
      await rule.save();
      rules.push(rule);
    }
    console.log(`Created 15 rules.`);

    // 4. Seed Alerts (15 alerts)
    const alerts = [];
    const alertStatuses = ['new', 'acknowledged', 'resolved', 'false_positive'];
    for (let i = 1; i <= 15; i++) {
      const alert = new Alert({
        rule_name: rules[i - 1].rule_name,
        device_id: devices[i - 1]._id,
        title: `Suspicious activity detected on ${devices[i - 1].name}`,
        description: `An alert generated based on ${rules[i - 1].rule_name}`,
        severity: severities[i % severities.length],
        status: alertStatuses[i % alertStatuses.length],
        source_ip: `10.0.0.${i}`,
        event_count: Math.floor(Math.random() * 10) + 1,
        detected_at: new Date(Date.now() - i * 3600000)
      });
      await alert.save();
      alerts.push(alert);
    }
    console.log(`Created 15 alerts.`);

    // 5. Seed Incidents (15 incidents)
    const incidents = [];
    const incidentStatuses = ['open', 'investigating', 'remediated', 'closed'];
    const incSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    for (let i = 1; i <= 15; i++) {
      const incident = new Incident({
        title: `Incident Response Case #${100 + i}`,
        description: `Investigating correlated alerts on Zone-${['A', 'B', 'C'][i % 3]}`,
        status: incidentStatuses[i % incidentStatuses.length],
        severity: incSeverities[i % incSeverities.length],
        assigned_to: users[i % users.length]._id,
        alert_ids: [alerts[i - 1]._id]
      });
      
      // If incident is assigned, update alert to be part of the incident
      if (alerts[i - 1]) {
        alerts[i - 1].incident_id = incident._id;
        await alerts[i - 1].save();
      }

      await incident.save();
      incidents.push(incident);
    }
    console.log(`Created 15 incidents.`);

    // 6. Seed Incident Timelines (15 timelines)
    for (let i = 1; i <= 15; i++) {
      const timeline = new IncidentTimeline({
        incident_id: incidents[i - 1]._id,
        action_type: i % 2 === 0 ? 'status_change' : 'manual_note',
        actor: users[i % users.length].username,
        description: `Updated incident status/notes during investigation step ${i}`
      });
      await timeline.save();
    }
    console.log(`Created 15 incident timelines.`);

    // 7. Seed Audit Logs (15 logs)
    for (let i = 1; i <= 15; i++) {
      const log = new AuditLog({
        userId: users[i % users.length]._id,
        username: users[i % users.length].username,
        action: i % 2 === 0 ? 'LOGIN' : 'UPDATE_DEVICE',
        target_resource: 'System',
        status: i % 4 === 0 ? 'FAILED' : 'SUCCESS',
        ipAddress: `192.168.1.${i + 100}`,
        userAgent: 'Mozilla/5.0'
      });
      await log.save();
    }
    console.log(`Created 15 audit logs.`);

    // 8. Seed Blocked IPs (15 IPs)
    for (let i = 1; i <= 15; i++) {
      const blockedIp = new BlockedIp({
        ipAddress: `10.10.10.${i}`,
        reason: 'Multiple failed login attempts or malicious traffic',
        blockedBy: users[0]._id, // Admin
        expiresAt: new Date(Date.now() + 86400000) // 1 day later
      });
      await blockedIp.save();
    }
    console.log(`Created 15 blocked IPs.`);

    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
