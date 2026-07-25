import mqtt from 'mqtt';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { encryptPayload } from '../utils/crypto.js';

let client = null;

export const connectMqtt = () => {
  logger.info(`Connecting to MQTT Broker at ${config.mqtt.url}`);
  
  client = mqtt.connect(config.mqtt.url, {
    clientId: config.mqtt.clientId,
    reconnectPeriod: 1000,
  });

  client.on('connect', () => {
    logger.info('Connected to MQTT Broker successfully.');
    client.subscribe(`${config.mqtt.controlTopic}/#`, (err) => {
      if (!err) logger.info(`Subscribed to ${config.mqtt.controlTopic}/#`);
    });
  });

  client.on('message', (topic, message) => {
    logger.info(`Received message on ${topic}: ${message.toString()}`);
  });

  client.on('error', (err) => {
    logger.error(`MQTT Error: ${err.message}`);
  });
};

export const getClient = () => client;

export const publishTelemetry = (deviceId, payload) => {
  if (!client || !client.connected) return;
  const topic = `${config.mqtt.telemetryTopicPrefix}/${deviceId}`;
  const securePayload = encryptPayload(payload);
  client.publish(topic, securePayload, { qos: 1 });
  logger.info(`Published telemetry for ${deviceId}`);
};
