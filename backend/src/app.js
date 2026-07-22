import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors.js';
import { globalLimiter, authLimiter } from './config/rateLimit.js';
import fs from 'fs';
import http from 'http';
import swaggerUi from 'swagger-ui-express';

// Constants
import { REQUEST_BODY_LIMIT } from './constants/index.js';

// Database context and models
import { connectDB } from './models/index.js';

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
import aiRoutes from './routes/aiRoutes.js';

const app = express();
const server = http.createServer(app);
const PORT = process.env.BACKEND_PORT || process.env.PORT || 8000;

app.use(cors(corsOptions));

app.use(cookieParser());
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ limit: REQUEST_BODY_LIMIT, extended: true }));
app.set('trust proxy', 1);

app.use(ipBlockMiddleware);

app.use(globalLimiter);


const swaggerDocument = JSON.parse(fs.readFileSync('./swagger-output.json', 'utf8'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
  res.status(200).json({
    name: 'ICS-Guard API',
    description: 'Industrial Control Systems Guard Security API for Critical Infrastructure Protection',
    version: '1.0.0',
    status: 'Operational',
    timestamp: new Date(),
  });
});
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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/ai', aiRoutes);

app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || (statusCode >= 500 ? 'InternalServerError' : 'BadRequest'),
    message: err.message || 'An unexpected error occurred.',
  });
});



const startServer = async () => {
  await connectDB();

  await initInflux();

  connectMqtt();

  try {
    await connectQueue();
  } catch (err) {
    console.warn('[Bootstrap] Queue connection warning: RabbitMQ might be starting up in Docker. Worker will try auto-reconnecting...');
  }
  
  initTelegramBot();

  initSocket(server);

  server.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`ICS-GUARD SECURITY API RUNNING ON PORT ${PORT}`);
    console.log(`Database (MongoDB): ${process.env.MONGO_URI}`);
    console.log(`Time: ${new Date().toLocaleString()}`);
    console.log(`=============================================================\n`);
  });
};

startServer();
