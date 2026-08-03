import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User, Device, Rule, Playbook, Incident } from '../models/index.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ics-guard';

const runSeed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // 1. Clear existing data (optional, but good for clean demo)
    console.log('Clearing existing Demo data...');
    await Device.deleteMany({ _id: { $in: ['DEV-DEMO-001', 'DEV-DEMO-002', 'DEV-DEMO-003'] } });
    await Rule.deleteMany({ rule_name: { $in: ['DETECT_MODBUS_FLOOD', 'DETECT_UNAUTHORIZED_FIRMWARE'] } });
    await Playbook.deleteMany({ is_demo: true });
    await Incident.deleteMany({ is_demo: true });

    // 2. Seed Devices
    const devices = [
      {
        _id: 'DEV-DEMO-001',
        name: 'Siemens S7-1200 PLC',
        ipAddress: '192.168.1.100',
        macAddress: '00:1B:1B:1A:2B:3C',
        node_type: 'controller',
        status: 'active',
        zone: 'OT-Zone-1',
        firmware_version: 'V4.4.1',
        hardware_model: 'Siemens SIMATIC S7-1200',
        is_demo: true,
        iconPath: 'Cpu'
      },
      {
        _id: 'DEV-DEMO-002',
        name: 'Modbus RTU Sensor (Temp)',
        ipAddress: '192.168.1.101',
        macAddress: '00:1B:1B:2A:3B:4C',
        node_type: 'sensor',
        status: 'active',
        zone: 'OT-Zone-1',
        firmware_version: 'v1.2',
        hardware_model: 'Generic Modbus Sensor',
        is_demo: true,
        iconPath: 'Thermometer'
      },
      {
        _id: 'DEV-DEMO-003',
        name: 'ABB RTU 500',
        ipAddress: '192.168.2.100',
        macAddress: '00:1B:1B:3C:4D:5E',
        node_type: 'controller',
        status: 'quarantined',
        zone: 'OT-Zone-2',
        firmware_version: '12.0',
        hardware_model: 'ABB RTU500 series',
        is_demo: true,
        iconPath: 'Cpu'
      }
    ];
    
    const createdDevices = await Device.insertMany(devices);
    console.log(`Seeded ${createdDevices.length} devices.`);

    // 3. Seed Rules
    const rules = [
      {
        rule_id: 'DEMO-RULE-001',
        rule_name: 'DETECT_MODBUS_FLOOD',
        description: 'Phát hiện lưu lượng Modbus/TCP cao bất thường',
        condition: 'network.traffic > 1000',
        severity: 'HIGH',
        trigger_count: 5,
        time_window_seconds: 60,
        is_active: true,
        is_demo: true
      },
      {
        rule_id: 'DEMO-RULE-002',
        rule_name: 'DETECT_UNAUTHORIZED_FIRMWARE',
        description: 'Phát hiện cập nhật Firmware không hợp lệ từ IP lạ',
        condition: 'device.firmware_update == true && network.src_ip != "192.168.1.10"',
        severity: 'CRITICAL',
        trigger_count: 1,
        time_window_seconds: 300,
        is_active: true,
        is_demo: true
      }
    ];
    const createdRules = await Rule.insertMany(rules);
    console.log(`Seeded ${createdRules.length} rules.`);

    // 4. Seed Playbooks
    const playbooks = [
      {
        name: 'Auto Isolate on Firmware Attack',
        description: 'Tự động ngắt mạng thiết bị khi phát hiện cập nhật Firmware trái phép',
        trigger_rule: 'DETECT_UNAUTHORIZED_FIRMWARE',
        actions: [{ action_type: 'isolate_device', params: {} }],
        is_active: true,
        is_demo: true
      }
    ];
    const createdPlaybooks = await Playbook.insertMany(playbooks);
    console.log(`Seeded ${createdPlaybooks.length} playbooks.`);

    // 5. Seed Incidents (for Heatmap and Reports)
    const incidents = [];
    const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const statuses = ['open', 'investigating', 'closed'];
    
    // Create random incidents over the last 7 days
    for (let i = 0; i < 50; i++) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - Math.floor(Math.random() * 7));
      pastDate.setHours(Math.floor(Math.random() * 24));
      
      incidents.push({
        title: `Demo Incident #${i + 1}`,
        description: 'Tự động tạo cho mục đích Demo UI.',
        severity: severities[Math.floor(Math.random() * severities.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        device_id: createdDevices[0]._id,
        is_demo: true,
        createdAt: pastDate,
        updatedAt: pastDate
      });
    }
    const createdIncidents = await Incident.insertMany(incidents);
    console.log(`Seeded ${createdIncidents.length} incidents.`);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

runSeed();
