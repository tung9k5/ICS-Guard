import TelegramBot from 'node-telegram-bot-api';
import { Device, BlockedIp, AuditLog, User } from '../models/index.js';
import socketService from './socketService.js';

const userCache = new Map();

export const backupDeletedUser = (userId, userData) => {
  userCache.set(userId, userData);
  setTimeout(() => {
    userCache.delete(userId);
  }, 5 * 60 * 1000); // 5 minutes
};

let bot = null;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const isBotConfigured = botToken && botToken !== 'YOUR_TELEGRAM_BOT_TOKEN';
const isPollingEnabled = process.env.TELEGRAM_POLLING_ENABLED !== 'false';

// Setup Mock Bot for test/simulation when token is missing
const mockBot = {
  sendMessage: async (targetChatId, text, options) => {
    console.log(`\n--- [MOCK TELEGRAM BOT] MESSAGE SENT TO CHAT ${targetChatId} ---`);
    let cleanText = text;
    if (process.env.NODE_ENV === 'production') {
      cleanText = text.replace(/\b\d{6}\b/, '******');
    }
    console.log(cleanText);
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
    let cleanText = text;
    if (process.env.NODE_ENV === 'production') {
      cleanText = text.replace(/\b\d{6}\b/, '******');
    }
    console.log(cleanText);
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
  if (isBotConfigured && isPollingEnabled) {
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
            const deviceId = param;
            const device = await Device.findById(String(deviceId));
            if (!device) {
              alertResponseText = '[ERROR] Device not found.';
            } else if (device.status === 'isolated') {
              alertResponseText = `[WARNING] Device "${device.name}" is already isolated.`;
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

              alertResponseText = `[SUCCESS] Device "${device.name}" (IP: ${device.ipAddress}) has been ISOLATED by Admin via Telegram.`;
            }
          } else if (action === 'block_ip') {
            const ipAddress = param;
            const existingBlock = await BlockedIp.findOne({ ipAddress });

            if (existingBlock && new Date(existingBlock.expiresAt) > new Date()) {
              alertResponseText = `[WARNING] IP ${ipAddress} is already blocked.`;
            } else {
              const expiresAt = new Date();
              expiresAt.setHours(expiresAt.getHours() + 24); // Block for 24 hours

              await BlockedIp.findOneAndUpdate(
                { ipAddress },
                { ipAddress, reason: 'Brute-force lockout triggered via Telegram admin action', expiresAt },
                { upsert: true, new: true }
              );

              // Write Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (Admin Action)',
                action: `Block IP Address: ${ipAddress}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ ipAddress, duration: '24h', reason: 'Telegram admin trigger' }),
              });

              alertResponseText = `[SUCCESS] IP Address ${ipAddress} has been BLOCKED for 24 hours by Admin via Telegram.`;
            }
          } else if (action === 'confirm_delete_user') {
            const targetUserId = param;
            const targetUser = await User.findById(targetUserId);

            if (!targetUser) {
              alertResponseText = '[WARNING] Tài khoản này không tồn tại hoặc đã bị xóa trước đó.';
            } else {
              const username = targetUser.username;
              const email = targetUser.email;
              const userTelegramId = targetUser.contactInfo?.telegramChatId;

              await targetUser.deleteOne();

              // Write Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (Admin Confirm Delete)',
                action: `Hard Delete User: ${username}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ userId: targetUserId, username, email }),
              });

              // Emit WebSocket sync
              const io = socketService.getIo();
              if (io) {
                io.emit('USER_SYNC', { action: 'delete', userId: targetUserId });
              }

              // Notify user if Telegram Chat ID exists
              if (userTelegramId) {
                sendTelegramAlert(
                  `⛔ [THÔNG BÁO XÓA TÀI KHOẢN VĨNH VIỄN]\n\nTài khoản *${username}* (${email}) của bạn đã được Quản trị viên bấm XÁC NHẬN XÓA VĨNH VIỄN qua Telegram.`,
                  [],
                  userTelegramId
                );
              }

              alertResponseText = `[SUCCESS] Đã XÁC NHẬN XÓA VĨNH VIỄN tài khoản "${username}" (${email}) ngay lập tức!`;
            }
          } else if (action === 'restore_user') {
            const targetUserId = param;
            const targetUser = await User.findById(targetUserId);

            if (!targetUser) {
              alertResponseText = '[ERROR] Không tìm thấy tài khoản để khôi phục.';
            } else {
              targetUser.deletion_pending = false;
              targetUser.status = 'active';
              targetUser.is_active = true;
              targetUser.deletion_requested_at = null;
              targetUser.deletion_expires_at = null;
              targetUser.deletion_requested_by = null;
              await targetUser.save();

              // Write Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (Admin Restore Action)',
                action: `Restore User: ${targetUser.username}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ userId: targetUserId, username: targetUser.username }),
              });

              // Emit WebSocket sync
              const io = socketService.getIo();
              if (io) {
                io.emit('USER_SYNC', { action: 'update', user: targetUser });
                io.emit('ACCOUNT_STATUS_CHANGED', { userId: targetUserId, status: 'active', is_active: true });
              }

              // Notify user if Telegram Chat ID exists
              if (targetUser.contactInfo?.telegramChatId) {
                sendTelegramAlert(
                  `✅ [THÔNG BÁO KHÔI PHỤC TÀI KHOẢN]\n\nTài khoản *${targetUser.username}* của bạn đã được Quản trị viên KHÔI PHỤC hoạt động bình thường qua Telegram.`,
                  [],
                  targetUser.contactInfo.telegramChatId
                );
              }

              alertResponseText = `[SUCCESS] Đã KHÔI PHỤC tài khoản "${targetUser.username}" thành công!`;
            }
          } else if (action === 'undo_delete') {
            const userId = param;
            const userData = userCache.get(userId);

            if (!userData) {
              alertResponseText = '[ERROR] Đã quá thời hạn 5 phút hoặc tài khoản không thể khôi phục.';
            } else {
              // Restore user
              await User.create(userData);
              userCache.delete(userId);

              // Emit WebSocket sync
              const io = socketService.getIo();
              if (io) {
                io.emit('USER_SYNC', { action: 'create', user: userData });
              }

              // Audit Log
              await AuditLog.create({
                userId: null,
                username: 'TelegramBot (HR Action)',
                action: `Restore User: ${userData.username}`,
                ipAddress: 'Telegram_Bot_API',
                userAgent: 'Telegram Bot',
                details: JSON.stringify({ userId, username: userData.username, role: userData.role }),
              });

              alertResponseText = `[SUCCESS] Đã khôi phục thành công tài khoản của "${userData.username}"!`;
            }
          } else {
            alertResponseText = '[ERROR] Unknown action requested.';
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
          bot.answerCallbackQuery(id, { text: '[ERROR] Error executing action.' }).catch(() => { });
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
    const reason = isPollingEnabled ? 'not configured or using default token' : 'polling disabled';
    console.log(`[TelegramService] Telegram Bot ${reason}. Running in Mock Mode.`);
    bot = mockBot;
  }
};

export const _testSpies = {
  sendTelegramAlertCalls: [],
  reset() {
    this.sendTelegramAlertCalls = [];
  }
};

// Send Telegram alerts with target role routing
export const sendTelegramAlert = async (text, inlineButtons = [], targetRoles = ['admin', 'analyst'], customChatId = null) => {
  if (process.env.NODE_ENV === 'test') {
    _testSpies.sendTelegramAlertCalls.push({ text, inlineButtons, targetRoles, customChatId });
    return { message_id: 9999, text, chat: { id: 'test' } };
  }

  if (!bot) {
    bot = mockBot;
  }

  const options = {};
  if (inlineButtons && inlineButtons.length > 0) {
    options.reply_markup = {
      inline_keyboard: [inlineButtons],
    };
  }

  if (typeof customChatId === 'string' && customChatId.length > 0) {
    try {
      const message = await bot.sendMessage(customChatId, text, options);
      return message;
    } catch (error) {
      console.error(`[TelegramService] Failed to send Telegram to customChatId ${customChatId}:`, error);
      return null;
    }
  }

  try {
    const rolesFilter = Array.isArray(targetRoles) ? targetRoles : ['admin', 'analyst'];
    const activeResponders = await User.find({
      role: { $in: rolesFilter },
      'contactInfo.telegramChatId': { $ne: null },
      isAlertEnabled: true
    });

    if (activeResponders && activeResponders.length > 0) {
      console.log(`[TelegramService] Định tuyến cảnh báo Telegram đến ${activeResponders.length} tài khoản (${rolesFilter.join(', ')})...`);
      let lastMessage = null;
      for (const responder of activeResponders) {
        const targetChat = responder.contactInfo.telegramChatId;
        try {
          lastMessage = await bot.sendMessage(targetChat, text, options);
        } catch (err) {
          console.error(`[TelegramService] Gửi tin nhắn lỗi cho ${responder.username} (${targetChat}):`, err);
        }
      }
      return lastMessage;
    } else {
      const targetChat = isBotConfigured ? chatId : 'MOCK_CHAT_ID';
      console.log(`[TelegramService] Chưa có Chat ID động cho role ${rolesFilter.join('/')}. Fallback tin nhắn: ${targetChat}`);
      const message = await bot.sendMessage(targetChat, text, options);
      return message;
    }
  } catch (error) {
    console.error('[TelegramService] Lỗi định tuyến thông báo Telegram:', error);
    const targetChat = isBotConfigured ? chatId : 'MOCK_CHAT_ID';
    try {
      const message = await bot.sendMessage(targetChat, text, options);
      return message;
    } catch (err) {
      return null;
    }
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
    const deviceId = param;
    const device = await Device.findById(String(deviceId));
    if (!device) {
      alertResponseText = '[ERROR] Device not found.';
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

      alertResponseText = `[SUCCESS] Device "${device.name}" (IP: ${device.ipAddress}) has been ISOLATED by Admin via Telegram (Simulated).`;
    }
  } else if (action === 'block_ip') {
    const ipAddress = param;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await BlockedIp.findOneAndUpdate(
      { ipAddress },
      { ipAddress, reason: 'Brute-force lockout triggered via Telegram admin action (Simulated)', expiresAt },
      { upsert: true, new: true }
    );

    await AuditLog.create({
      userId: null,
      username: 'TelegramBot (Simulated Action)',
      action: `Block IP Address: ${ipAddress}`,
      ipAddress: 'Simulated_Telegram_API',
      userAgent: 'Telegram Bot Simulator',
      details: JSON.stringify({ ipAddress, duration: '24h', reason: 'Telegram admin trigger (Simulated)' }),
    });

    alertResponseText = `[SUCCESS] IP Address ${ipAddress} has been BLOCKED for 24 hours by Admin via Telegram (Simulated).`;
  }

  console.log(`[TelegramService Simulation] Result: ${alertResponseText}`);
  return alertResponseText;
};

export default {
  initTelegramBot,
  sendTelegramAlert,
  simulateTelegramCallback,
};
