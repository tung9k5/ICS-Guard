import amqp from 'amqplib';
import { Alert, Incident, IncidentTimeline } from '../models/index.js';
import { ALERT_STATUSES, INCIDENT_STATUSES, SEVERITY_LEVELS, INCIDENT_TIMELINE_TYPES } from '../constants/index.js';

let connection = null;
let channel = null;

const RABBITMQ_URL = process.env.RABBITMQ_URL;
const AI_ANALYSIS_QUEUE = 'ai_analysis_queue';
const AI_RESPONSE_QUEUE = 'ai_response_queue';

export const connectQueue = async () => {
  if (connection && channel) return { connection, channel };

  let retries = 5;
  while (retries > 0) {
    try {
      console.log(`[QueueService] Connecting to RabbitMQ at: ${RABBITMQ_URL}...`);
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      
      // Ensure queues exist
      await channel.assertQueue(AI_ANALYSIS_QUEUE, { durable: true });
      await channel.assertQueue(AI_RESPONSE_QUEUE, { durable: true });

      console.log('[QueueService] RabbitMQ connected and queues asserted.');
      
      // Start listening to AI responses immediately upon connection
      startListeningToAiResponses();
      
      return { connection, channel };
    } catch (error) {
      console.error(`[QueueService] Failed to connect to RabbitMQ (Retries left: ${retries - 1}):`, error.message);
      retries -= 1;
      if (retries === 0) {
        console.error('[QueueService] Max retries reached. RabbitMQ connection failed.');
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
    }
  }
};

export const sendToQueue = async (queueName, data) => {
  try {
    const { channel } = await connectQueue();
    const payload = JSON.stringify(data);
    channel.sendToQueue(queueName, Buffer.from(payload), { persistent: true });
    console.log(`[QueueService] Message sent to queue "${queueName}".`);
  } catch (error) {
    console.error(`[QueueService] Error sending to queue "${queueName}":`, error.message);
  }
};

const startListeningToAiResponses = async () => {
  try {
    channel.consume(AI_RESPONSE_QUEUE, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log('[QueueService] Received AI response payload:', content);

          const { alertId, isAnomaly, attackType, description, remediationSteps } = content;

          // 1. Update Alert with Anomaly & Analysis status
          const alert = await Alert.findById(alertId);
          if (alert) {
            alert.status = isAnomaly ? ALERT_STATUSES.NEW : ALERT_STATUSES.RESOLVED;
            if (isAnomaly) {
              alert.description = `${alert.description} | AI Classification: ${attackType} | ${description}`;
              alert.severity = SEVERITY_LEVELS.HIGH;
            }
            await alert.save();

            // 2. If it's a critical/anomaly, create an Incident and assign remediation steps
            if (isAnomaly) {
              const incident = await Incident.create({
                title: `Sự cố: Phát hiện tấn công ${attackType} trên thiết bị ${alert.device_id}`,
                description: description || `Hệ thống AI phát hiện bất thường và phân loại hành vi là ${attackType}.`,
                status: INCIDENT_STATUSES.INVESTIGATING,
                severity: SEVERITY_LEVELS.HIGH,
                alert_ids: [alert._id],
              });

              // Write Incident Timeline
              await IncidentTimeline.create({
                incident_id: incident._id,
                actor: 'AI Engine Security Assistant',
                action_type: INCIDENT_TIMELINE_TYPES.AI_ANALYSIS,
                description: `Phân tích AI cho thấy hành vi tấn công ${attackType}. Khuyến nghị khắc phục:\n` + 
                  remediationSteps.map((step, index) => `${index + 1}. ${step}`).join('\n'),
                metadata: {
                  attackType,
                  remediationSteps,
                },
              });

              console.log(`[QueueService] Successfully created Incident ${incident._id} based on AI Response.`);
            }
          }

          channel.ack(msg);
        } catch (err) {
          console.error('[QueueService] Error processing AI response message:', err.message);
          channel.nack(msg, false, false); // Reject and don't re-queue corrupt JSON
        }
      }
    });
    console.log(`[QueueService] Started consuming from queue "${AI_RESPONSE_QUEUE}".`);
  } catch (error) {
    console.error(`[QueueService] Error consuming queue "${AI_RESPONSE_QUEUE}":`, error.message);
  }
};

export default {
  connectQueue,
  sendToQueue,
};
