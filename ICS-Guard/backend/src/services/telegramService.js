import TelegramBot from 'node-telegram-bot-api';
import { Device, BlockedIp, AuditLog } from '../models/index.js';

let bot = null;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const isBotConfigured = botToken && botToken !== 'YOUR_TELEGRAM_BOT_TOKEN';

// Setup Mock Bot for test/simulation when token is missing
const mockBot = {
  sendMessage: async (targetChatId, text, options) => {
    console.log(`\n--- [MOCK TELEGRAM BOT] MESSAGE SENT TO CHAT ${targetChatId} ---`);
    console.log(text);
    if (options && options.reply_markup) {
      console.log('Inline Buttons:');
      options.reply_markup.inline_keyboard.forEach(row => {
        row.forEach(btn => {
          console.log(`  - [${btn.text}] (callback_data: ${btn.callback_data})`);
        });
      });
    }
    console.log('-----------------------------------------------------\n');
    return { message_id: 9999, text, chat: { id: targetChatId } };
  },
  editMessageText: async (text, options) => {
    console.log(`\n--- [MOCK TELEGRAM BOT] MESSAGE EDITED (ID: ${options.message_id}) ---`);
    console.log(text);
    console.log('-----------------------------------------------------\n');
    return { message_id: options.message_id, text };
  },
  answerCallbackQuery: async (callbackQueryId, options) => {
    console.log(`[MOCK TELEGRAM BOT] Answered callback query ${callbackQueryId}: ${options?.text || 'OK'}`);
    return true;
  }
};

// Initialize the Telegram Bot
export const initTelegramBot = () => {
  if (isBotConfigured) {
    console.log('[TelegramService] Initializing real Telegram Bot in polling mode...');
    try {
      bot = new TelegramBot(botToken, { polling: true });
      
      // Set up inline button click callback listener
      bot.on('callback_query', async (callbackQuery) => {
        const { id, data, message } = callbackQuery;
        const queryChatId = message.chat.id;
        const messageId = message.message_id;

        try {
          console.log(`[TelegramService] Received callback query from Telegram: "${data}"`);
          
          let alertResponseText = '';
          const [action, ...args] = data.split(':');
          const param = args.join(':'); // handles IP address colons if any (though IPv4 has no colons)

          if (action === 'isolate_device') {
            const deviceId = parseInt(param);
            const device = await Device.findByPk(deviceId);
            if (!device) {
              alertResponseText = '❌ Device not found.';
            } else if (device.status === 'isolated') {
              alertResponseText = `⚠️ Device "${device.name}" is already isolated.`;
            } else {
              device.status = 'isolated';
              await device.save();

              // Write Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (Admin Action)',
                action: `Isolate Device ID: ${device.id}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ deviceId: device.id, name: device.name, status: 'isolated' }),
              });

              alertResponseText = `✅ Device "${device.name}" (IP: ${device.ipAddress}) has been ISOLATED by Admin via Telegram.`;
            }
          } else if (action === 'block_ip') {
            const ipAddress = param;
            const existingBlock = await BlockedIp.findOne({ where: { ipAddress } });
            
            if (existingBlock && new Date(existingBlock.expiresAt) > new Date()) {
              alertResponseText = `⚠️ IP ${ipAddress} is already blocked.`;
            } else {
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + 24); // Block for 24 hours

              await BlockedIp.upsert({
                ipAddress,
                reason: 'Brute-force lockout triggered via Telegram admin action',
                expiresAt,
              });

              // Write Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (Admin Action)',
                action: `Block IP Address: ${ipAddress}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ ipAddress, duration: '24h', reason: 'Telegram admin trigger' }),
              });

              alertResponseText = `✅ IP Address ${ipAddress} has been BLOCKED for 24 hours by Admin via Telegram.`;
            }
          } else {
            alertResponseText = '❌ Unknown action requested.';
          }

          // Acknowledge the callback click so Telegram stops showing loading spinner
          await bot.answerCallbackQuery(id, { text: alertResponseText });

          // Update the original message text to show the action taken
          const originalText = message.text;
          const updatedMessageText = `${originalText}\n\n[ADMIN UPDATE]\n${alertResponseText}`;
          
          await bot.editMessageText(updatedMessageText, {
            chat_id: queryChatId,
            message_id: messageId,
          });

        } catch (error) {
          console.error('[TelegramService] Error handling callback query:', error);
          bot.answerCallbackQuery(id, { text: '❌ Error executing action.' }).catch(() => {});
        }
      });

      // Simple handler for error logs
      bot.on('polling_error', (error) => {
        // Only log serious errors or quiet down repeated network issues
        if (error.code !== 'EFATAL') {
          console.warn('[TelegramService] Polling warning:', error.message);
        } else {
          console.error('[TelegramService] Polling error:', error);
        }
      });

    } catch (error) {
      console.error('[TelegramService] Failed to initialize Telegram Bot. Falling back to Mock Bot.', error);
      bot = mockBot;
    }
  } else {
    console.log('[TelegramService] Telegram Bot is not configured or using default token. Running in Mock Mode.');
    bot = mockBot;
  }
};

export const _testSpies = {
  sendTelegramAlertCalls: [],
  reset() {
    this.sendTelegramAlertCalls = [];
  }
};

// Send Telegram alerts
export const sendTelegramAlert = async (text, inlineButtons = []) => {
  if (process.env.NODE_ENV === 'test') {
    _testSpies.sendTelegramAlertCalls.push({ text, inlineButtons });
    return { message_id: 9999, text, chat: { id: 'test' } };
  }

  if (!bot) {
    // If not initialized yet, initialize mock
    bot = mockBot;
  }

  const targetChat = isBotConfigured ? chatId : 'MOCK_CHAT_ID';

  const options = {};
  if (inlineButtons && inlineButtons.length > 0) {
    options.reply_markup = {
      inline_keyboard: [inlineButtons],
    };
  }

  try {
    const message = await bot.sendMessage(targetChat, text, options);
    return message;
  } catch (error) {
    console.error('[TelegramService] Failed to send Telegram alert:', error);
    return null;
  }
};

// Help helper to trigger a simulated telegram action (e.g. for testing)
export const simulateTelegramCallback = async (callbackData, messageText = 'Alert') => {
  console.log(`[TelegramService Simulation] Simulating click on: "${callbackData}"`);
  
  // Create a dummy message
  const dummyMessage = {
    chat: { id: 123456 },
    message_id: 8888,
    text: messageText,
  };
  
  // Call internal callback handler logic if it's mockBot or real bot
  // We can simulate it by recreating the callback_query event
  let alertResponseText = '';
  const [action, ...args] = callbackData.split(':');
  const param = args.join(':');

  if (action === 'isolate_device') {
    const deviceId = parseInt(param);
    const device = await Device.findByPk(deviceId);
    if (!device) {
      alertResponseText = '❌ Device not found.';
    } else {
      device.status = 'isolated';
      await device.save();

      await AuditLog.create({
        userId: null,
        username: 'TelegramBot (Simulated Action)',
        action: `Isolate Device ID: ${device.id}`,
        ipAddress: 'Simulated_Telegram_API',
        userAgent: 'Telegram Bot Simulator',
        details: JSON.stringify({ deviceId: device.id, name: device.name, status: 'isolated' }),
      });

      alertResponseText = `✅ Device "${device.name}" (IP: ${device.ipAddress}) has been ISOLATED by Admin via Telegram (Simulated).`;
    }
  } else if (action === 'block_ip') {
    const ipAddress = param;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await BlockedIp.upsert({
      ipAddress,
      reason: 'Brute-force lockout triggered via Telegram admin action (Simulated)',
      expiresAt,
    });

    await AuditLog.create({
      userId: null,
      username: 'TelegramBot (Simulated Action)',
      action: `Block IP Address: ${ipAddress}`,
      ipAddress: 'Simulated_Telegram_API',
      userAgent: 'Telegram Bot Simulator',
      details: JSON.stringify({ ipAddress, duration: '24h', reason: 'Telegram admin trigger (Simulated)' }),
    });

    alertResponseText = `✅ IP Address ${ipAddress} has been BLOCKED for 24 hours by Admin via Telegram (Simulated).`;
  }

  console.log(`[TelegramService Simulation] Result: ${alertResponseText}`);
  return alertResponseText;
};

export default {
  initTelegramBot,
  sendTelegramAlert,
  simulateTelegramCallback,
};
