import { connectMqtt } from './mqtt/index.js';
import { simulatorManager } from './scheduler/index.js';
import { logger } from './utils/logger.js';
import { config } from './config/index.js';

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

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    simulatorManager.stop();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down...');
    simulatorManager.stop();
    process.exit(0);
  });
}

bootstrap();
