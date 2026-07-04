import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// Database context and models
import { connectDB, User, Device, Rule } from './models/index.js';

// Middlewares
import ipBlockMiddleware from './middlewares/ipBlockMiddleware.js';

// Services
import { initTelegramBot } from './services/telegramService.js';
import { connectQueue } from './services/queueService.js';
import { connectMqtt } from './services/mqttService.js';
import { initInflux } from './services/influxService.js';
import { initSocket } from './services/socketService.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import attackRoutes from './routes/attackRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Express trust proxy setup (so req.ip parses header correctly behind proxies)
app.set('trust proxy', true);

// 1. Apply global IP block middleware BEFORE any other route
app.use(ipBlockMiddleware);

// 2. Configure Swagger UI
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ICS-Guard API Documentation',
      version: '1.0.0',
      description: 'API Document for ICS-Guard System (Industrial Control Systems Security Guard)',
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token in format: Bearer <token>',
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
app.use('/api/attacks', attackRoutes);

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

    // Seed Users (Force refresh to apply the new enterprise roles schema)
    console.log('[Bootstrap] Wiping and re-seeding Users collection to apply new enterprise roles...');
    await User.deleteMany({});
    const usersData = parseSeedFile('users.json');
    if (usersData && usersData.length > 0) {
      for (let user of usersData) {
        let plainPassword = 'User@123';
        if (user.username === 'admin_soc') plainPassword = 'Admin@123';
        else if (user.username === 'l1_analyst') plainPassword = 'L1@123';
        else if (user.username === 'l2_responder') plainPassword = 'L2@123';
        else if (user.username === 'l3_manager') plainPassword = 'L3@123';
        else if (user.username === 'ot_operator') plainPassword = 'OT@123';
        
        user.password_hash = await bcrypt.hash(plainPassword, 10);
        console.log(`[Bootstrap] Seeding user "${user.username}" with password "${plainPassword}"`);
      }
      await User.insertMany(usersData);
      console.log(`[Bootstrap] Seeded ${usersData.length} users into MongoDB.`);
    }

    // Seed Devices (Force refresh to apply the new hierarchical schema)
    const devicesData = parseSeedFile('devices.json');
    if (devicesData && devicesData.length > 0) {
      console.log('[Bootstrap] Wiping and re-seeding Devices collection to apply new schema...');
      await Device.deleteMany({});
      await Device.insertMany(devicesData);
      console.log(`[Bootstrap] Seeded ${devicesData.length} devices into MongoDB.`);
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

  // Initialize Socket.io service
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🛡️  ICS-GUARD SECURITY API RUNNING ON PORT ${PORT}  🛡️`);
    console.log(`Database (MongoDB): ${process.env.MONGO_URI || 'mongodb://localhost:27017/ics_guard'}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);
  });
};

startServer();
