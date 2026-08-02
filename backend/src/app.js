import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors.js';
import { globalLimiter, authLimiter } from './config/rateLimit.js';
import fs from 'fs';
import http from 'http';
import swaggerUi from 'swagger-ui-express';
import logger from './utils/logger.js';

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
import settingRoutes from './routes/settingRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import simulatorRoutes from './routes/simulatorRoutes.js';
import notificationRoutes from './routes/notification.routes.js';
import { HTTP_STATUS } from './constants/index.js';


const app = express();
const server = http.createServer(app);
const PORT = process.env.BACKEND_PORT || process.env.PORT || 8000;

app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow Swagger UI to load inline scripts
  crossOriginEmbedderPolicy: false,
}));
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
  res.status(HTTP_STATUS.OK).json({
    name: 'ICS-Guard API',
    description: 'Industrial Control Systems Guard Security API for Critical Infrastructure Protection',
    version: '1.0.0',
    status: 'Operational',
    timestamp: new Date(),
  });
});
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/v1/auth', authLimiter, authRoutes); // Alias for Google OAuth redirect compatibility
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
app.use('/api/settings', settingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((err, req, res, next) => {
  logger.error('[Global Error]', { message: err.message, stack: err.stack });
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    error: err.name || (statusCode >= 500 ? 'InternalServerError' : 'BadRequest'),
    message: err.translations || err.message || 'An unexpected error occurred',
  });
});

const startServer = async () => {
  await connectDB();
  
  import('./services/settingService.js').then(module => {
    module.default.seedDefaultSettings().catch(err => logger.error('Failed to seed settings', err));
  });

  await initInflux();

  connectMqtt();

  try {
    await connectQueue();
  } catch (err) {
    logger.warn('[Bootstrap] Queue connection warning: RabbitMQ might be starting up in Docker. Worker will try auto-reconnecting...');
  }
  
  initTelegramBot();

  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`\n=============================================================`);
    logger.info(`ICS-GUARD SECURITY API RUNNING ON PORT ${PORT}`);
    logger.info(`Database: MongoDB [${process.env.MONGO_DB || 'ics-guard'}]`);
    logger.info(`Time: ${new Date().toLocaleString()}`);
    logger.info(`=============================================================`);
  });
};

startServer();
