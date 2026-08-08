import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import RedisStore from 'rate-limit-redis';
import redisClient from './config/redis.js';

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
import { decayRiskScores, checkAndUpdateAgingAdvisory } from './services/riskService.js';
import cron from 'node-cron';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import attackRoutes from './routes/attackRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import cveRoutes from './routes/cveRoutes.js';
import commandRoutes from './routes/commandRoutes.js';
import playbookRoutes from './routes/playbookRoutes.js';
import otPolicyRoutes from './routes/otPolicyRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Fail-Fast Validation
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'default_secret' || process.env.JWT_SECRET.length < 32) {
  console.error('[CRITICAL] JWT_SECRET is missing, default, or too weak. Must be at least 32 characters long. Halting application.');
  process.exit(1);
}

if (!process.env.AES_SECRET_KEY || process.env.AES_SECRET_KEY === '0123456789abcdef0123456789abcdef' || process.env.AES_SECRET_KEY.length !== 32) {
  console.error('[CRITICAL] AES_SECRET_KEY is missing, default, or invalid. Must be exactly 32 bytes. Halting application.');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Parse JSON request bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Express trust proxy setup (so req.ip parses header correctly behind proxies)
app.set('trust proxy', 1);

// 1. Apply global IP block middleware BEFORE any other route
app.use(ipBlockMiddleware);

// 1.5 Rate Limiting (Redis-based)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Allow up to 10,000 requests per 15 minutes for real-time OT monitoring
  message: { error: 'TooManyRequests', message: 'Quá nhiều truy vấn từ IP của bạn, vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  // store: new RedisStore({
  //   sendCommand: (...args) => redisClient.sendCommand(args),
  // }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Temporarily increased to 5000 requests per 15 mins to disable block
  message: { error: 'TooManyRequests', message: 'Tần suất đăng nhập quá cao, IP tạm khóa 15 phút để bảo vệ.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  // store: new RedisStore({
  //   sendCommand: (...args) => redisClient.sendCommand(args),
  // }),
});

// Apply global limiter to all routes
app.use(globalLimiter);

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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/v1/auth', authLimiter, authRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cves', cveRoutes);
app.use('/api/commands', commandRoutes);
app.use('/api/playbooks', playbookRoutes);
app.use('/api/ot-policy', otPolicyRoutes);
app.use('/api/ai', aiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred.',
  });
});

// Start Server
const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

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

  // === Background Cron Jobs ===
  // Every 48h: decay risk scores by 1 point for all approved devices
  cron.schedule('0 0 */2 * *', async () => {
    console.log('[Cron] Running 48h risk score decay...');
    await decayRiskScores();
  });

  // Daily at 01:00 AM: check aging advisories for all devices
  cron.schedule('0 1 * * *', async () => {
    console.log('[Cron] Running daily aging advisory check...');
    await checkAndUpdateAgingAdvisory();
  });

  server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`[ICS-GUARD] SECURITY API RUNNING ON PORT ${PORT}`);
    console.log(`Database (MongoDB): ${process.env.MONGO_URI || 'mongodb://localhost:27017/ics_guard'}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);
  });
};

startServer();
