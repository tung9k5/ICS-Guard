import { Setting } from '../models/index.js';

class SettingRepository {
  async findAll() {
    return Setting.find({}).lean();
  }

  async findByKey(key) {
    return Setting.findOne({ key }).lean();
  }

  async updateByKey(key, value) {
    return Setting.findOneAndUpdate(
      { key },
      { $set: { value } },
      { new: true, upsert: true }
    );
  }

  async deleteByKey(key) {
    return Setting.findOneAndDelete({ key, isSystem: false });
  }
}

export default new SettingRepository();
