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

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import deviceRoutes from './routes/deviceRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import incidentRoutes from './routes/incidentRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import attackRoutes from './routes/attackRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import cveRoutes from './routes/cveRoutes.js';
import playbookRoutes from './routes/playbookRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security Fail-Fast Validation
if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET === 'ics_guard_access_secret_key_2026_@_secure' || process.env.JWT_ACCESS_SECRET.length < 32) {
  console.error('[CRITICAL] JWT_ACCESS_SECRET is missing, default, or too weak. Must be at least 32 characters long. Halting application.');
  process.exit(1);
}

if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET === 'ics_guard_refresh_secret_key_2026_@_secure' || process.env.JWT_REFRESH_SECRET.length < 32) {
  console.error('[CRITICAL] JWT_REFRESH_SECRET is missing, default, or too weak. Must be at least 32 characters long. Halting application.');
  process.exit(1);
}

if (!process.env.AES_SECRET_KEY || process.env.AES_SECRET_KEY === '0123456789abcdef0123456789abcdef' || process.env.AES_SECRET_KEY.length !== 32) {
  console.error('[CRITICAL] AES_SECRET_KEY is missing, default, or invalid. Must be exactly 32 bytes. Halting application.');
  process.exit(1);
}

if (!process.env.AES_IV || process.env.AES_IV === 'abcdef9876543210' || process.env.AES_IV.length !== 16) {
  console.error('[CRITICAL] AES_IV is missing, default, or invalid. Must be exactly 16 bytes. Halting application.');
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
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { error: 'TooManyRequests', message: 'Quá nhiều truy vấn từ IP của bạn, vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 login attempts per 15 minutes per IP
  message: { error: 'TooManyRequests', message: 'Tần suất đăng nhập quá cao, IP tạm khóa 15 phút để bảo vệ.' },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
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
app.use('/api/users', userRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/telemetry', telemetryRoutes);
app.use('/api/attacks', attackRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cves', cveRoutes);
app.use('/api/playbooks', playbookRoutes);
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

  // Connect to Redis
  try {
    await redisClient.connect();
  } catch (err) {
    console.warn('[Bootstrap] Redis connection failed, running on mock client:', err.message);
  }

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
    const rawMongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/ics_guard';
    const maskedMongoUri = rawMongoUri.replace(/mongodb(\+srv)?:\/\/([^:]+):([^@]+)@/, 'mongodb$1://$2:******@');
    console.log(`Database (MongoDB): ${maskedMongoUri}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);
  });
};

startServer();
