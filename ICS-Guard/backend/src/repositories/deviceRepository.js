import { Device } from '../models/index.js';

class DeviceRepository {
  async findAll(query, sort, skip, limit, select) {
    return Device.find(query).select(select).sort(sort).skip(skip).limit(limit);
  }

  async countAll(query) {
    return Device.countDocuments(query);
  }

  async findById(id, select = null) {
    const query = Device.findById(id);
    if (select) query.select(select);
    return query.exec();
  }

  async findLastByPattern(pattern) {
    return Device.findOne({ _id: pattern }).sort({ _id: -1 });
  }

  async create(data) {
    return Device.create(data);
  }

  async updateById(id, data) {
    return Device.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Device.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return Device.deleteMany({ _id: { $in: ids } });
  }
}

export default new DeviceRepository();
