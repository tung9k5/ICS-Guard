import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Database context and models
import { connectDB, User, Device, Rule } from './models/index.js';

// Middlewares
import ipBlockMiddleware from './middlewares/ipBlockMiddleware.js';

// Services
import { initTelegramBot } from './services/telegramService.js';
import { connectQueue } from './services/queueService.js';
import { connectMqtt } from './services/mqttService.js';
import { initInflux } from './services/influxService.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Express trust proxy setup (so req.ip parses header correctly behind proxies)
app.set('trust proxy', true);

// 1. Apply global IP block middleware BEFORE any other route
app.use(ipBlockMiddleware);

// Base route for API overview
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'ICS-Guard API',
    description: 'Industrial Control Systems Guard Security API for Critical Infrastructure Protection',
    version: '1.0.0',
    status: 'Operational',
    timestamp: new Date(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/v1/auth', authRoutes);
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/telemetry', telemetryRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Database Seeding Logic (Phương án A)
const seedDatabase = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    const seedDir = path.resolve(__dirname, '../../scripts/seed');
    console.log(`[Bootstrap] Checking seed directory: ${seedDir}`);

    // Helper to read and clean seed files (parsing standard Dates)
    const parseSeedFile = (filename) => {
      const filePath = path.join(seedDir, filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`[Bootstrap] Seed file not found: ${filePath}`);
        return null;
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      return data.map(item => {
        const cleaned = { ...item };
        // Map EJSON dates
        if (cleaned.created_at && cleaned.created_at.$date) {
          cleaned.createdAt = new Date(cleaned.created_at.$date);
          delete cleaned.created_at;
        }
        if (cleaned.updated_at && cleaned.updated_at.$date) {
          cleaned.updatedAt = new Date(cleaned.updated_at.$date);
          delete cleaned.updated_at;
        }
        return cleaned;
      });
    };

    // Seed Users
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      const usersData = parseSeedFile('users.json');
      if (usersData && usersData.length > 0) {
        // Override admin_soc's password hash so it can be logged in with "Admin@123"
        for (let user of usersData) {
          if (user.username === 'admin_soc') {
            user.password_hash = await bcrypt.hash('Admin@123', 10);
            console.log('[Bootstrap] Overriding admin_soc password to "Admin@123" for local usage.');
          }
        }
        await User.insertMany(usersData);
        console.log(`[Bootstrap] Seeded ${usersData.length} users into MongoDB.`);
      }
    } else {
      console.log(`[Bootstrap] Users collection already has ${userCount} records. Skipping seeding.`);
      // Enforce admin_soc password to always be Admin@123 for local usage
      const adminUser = await User.findOne({ username: 'admin_soc' });
      if (adminUser) {
        adminUser.password_hash = await bcrypt.hash('Admin@123', 10);
        await adminUser.save();
        console.log('[Bootstrap] Ensured admin_soc password is "Admin@123" in existing database.');
      }
    }

    // Seed Devices
    const deviceCount = await Device.countDocuments();
    if (deviceCount === 0) {
      const devicesData = parseSeedFile('devices.json');
      if (devicesData && devicesData.length > 0) {
        await Device.insertMany(devicesData);
        console.log(`[Bootstrap] Seeded ${devicesData.length} devices into MongoDB.`);
      }
    } else {
      console.log(`[Bootstrap] Devices collection already has ${deviceCount} records. Skipping seeding.`);
    }

    // Seed Rules
    const ruleCount = await Rule.countDocuments();
    if (ruleCount === 0) {
      const rulesData = parseSeedFile('rules.json');
      if (rulesData && rulesData.length > 0) {
        await Rule.insertMany(rulesData);
        console.log(`[Bootstrap] Seeded ${rulesData.length} rules into MongoDB.`);
      }
    } else {
      console.log(`[Bootstrap] Rules collection already has ${ruleCount} records. Skipping seeding.`);
    }

  } catch (error) {
    console.error('[Bootstrap] Failed to sync and seed database:', error);
    process.exit(1);
  }
};

// Start Server
const startServer = async () => {
  // Sync databases & seed default assets
  await seedDatabase();

  // Initialize InfluxDB database
  await initInflux();

  // Connect to Mosquitto MQTT Broker
  connectMqtt();

  // Connect to RabbitMQ (background task listener)
  try {
    await connectQueue();
  } catch (err) {
    console.warn('[Bootstrap] Queue connection warning: RabbitMQ might be starting up in Docker. Worker will try auto-reconnecting...');
  }
  
  // Initialize Telegram Bot
  initTelegramBot();

  app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🛡️  ICS-GUARD SECURITY API RUNNING ON PORT ${PORT}  🛡️`);
    console.log(`Database (MongoDB): ${process.env.MONGO_URI || 'mongodb://localhost:27017/ics_guard'}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);
  });
};

startServer();
