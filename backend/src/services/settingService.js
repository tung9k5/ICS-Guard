import settingRepository from '../repositories/settingRepository.js';
import AppError from '../utils/AppError.js';
import { HTTP_STATUS } from '../constants/index.js';


class SettingService {
  async getAllSettings() {
    const settings = await settingRepository.findAll();
    return settings;
  }

  async getSettingByKey(key) {
    const setting = await settingRepository.findByKey(key);
    if (!setting) {
      throw new AppError('Setting not found', HTTP_STATUS.NOT_FOUND);
    }
    return setting;
  }

  async updateSetting(key, value) {
    const setting = await settingRepository.updateByKey(key, value);
    return setting;
  }

  async seedDefaultSettings() {
    const defaults = [
      { key: 'system_name', value: 'ICS-Guard Security Platform', description: 'Name of the system', isSystem: true },
      { key: 'timezone', value: 'UTC', description: 'System timezone', isSystem: true },
      { key: 'language', value: 'en', description: 'Default language', isSystem: true },
      { key: 'session_timeout', value: '30', description: 'Session timeout in minutes', isSystem: true },
      { key: 'password_expiry', value: '90', description: 'Password expiry in days', isSystem: true },
      { key: 'require_2fa', value: false, description: 'Require 2FA for all users', isSystem: true },
      { key: 'smtp_host', value: 'smtp.example.com', description: 'SMTP Host', isSystem: true },
      { key: 'smtp_port', value: '587', description: 'SMTP Port', isSystem: true },
      { key: 'telegram_bot_token', value: '', description: 'Telegram Bot Token for alerts', isSystem: true },
    ];

    for (const setting of defaults) {
      const exists = await settingRepository.findByKey(setting.key);
      if (!exists) {
        await settingRepository.updateByKey(setting.key, setting.value);
        // Also update description and isSystem which updateByKey doesn't handle in upsert easily if we just pass value.
        // Let's use the Mongoose model directly for seeder to be safe.
        import('../models/index.js').then(({ Setting }) => {
           Setting.findOneAndUpdate(
             { key: setting.key },
             { $set: setting },
             { upsert: true }
           ).exec();
        });
      }
    }
  }
}

export default new SettingService();
