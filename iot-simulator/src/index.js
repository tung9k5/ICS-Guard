import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectMqtt } from './mqtt/index.js';
import { simulatorManager } from './scheduler/index.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, 'public');

async function bootstrap() {
  logger.info('Starting IoT Simulator...');
  
  // 1. Connect to MQTT
  connectMqtt();

  // 2. Initialize devices
  simulatorManager.init();

  // 3. Start generating data after 2 seconds to allow MQTT connection
  setTimeout(() => {
    simulatorManager.start();
  }, config.simulator.startupTimeoutMs);

  // 4. Initialize Express HTTP Server
  const app = express();
  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);

  // Serve static assets
  app.use(express.static(publicPath));

  // Serve clean paths for HTML pages
  app.get('/attacks', (req, res) => {
    res.sendFile(path.join(publicPath, 'attacks.html'));
  });

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  const port = process.env.SIMULATOR_PORT || 5001;
  const server = app.listen(port, () => {
    logger.info(`Web Simulator running at http://localhost:${port}/`);
    logger.info(`Incident Simulator running at http://localhost:${port}/attacks`);
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down simulator services...');
    simulatorManager.stop();
    server.close(() => {
      logger.info('Web server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap();

