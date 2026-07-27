import 'dotenv/config';
import mongoose from 'mongoose';
import { Rule } from '../src/models/index.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://root:example@localhost:27017/ics_guard?authSource=admin';

const defaultRules = [
  {
    rule_name: 'ABNORMAL_TRAFFIC_SPIKE',
    description: 'Phát hiện lưu lượng mạng tăng đột biến (> 50,000 Bps). Nghi ngờ bị tấn công DDoS hoặc botnet.',
    is_active: true,
    severity: 'HIGH',
    conditions: [
      {
        field: 'bytes_per_second',
        operator: '>',
        value: 50000
      }
    ],
    time_window_seconds: 120,
    trigger_count: 1
  },
  {
    rule_name: 'CRITICAL_OVERHEAT',
    description: 'Nhiệt độ thiết bị vượt ngưỡng an toàn nghiêm trọng (> 85°C). Nguy cơ cháy nổ vật lý.',
    is_active: true,
    severity: 'CRITICAL',
    conditions: [
      {
        field: 'temperature',
        operator: '>',
        value: 85.0
      }
    ],
    time_window_seconds: 120,
    trigger_count: 1
  }
];

const seedRules = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB.');

    for (const rule of defaultRules) {
      await Rule.updateOne(
        { rule_name: rule.rule_name },
        { $set: rule },
        { upsert: true }
      );
      console.log(`Upserted rule: ${rule.rule_name}`);
    }

    console.log('Seed rules completed successfully.');
  } catch (error) {
    console.error('Seed rules failed:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedRules();
