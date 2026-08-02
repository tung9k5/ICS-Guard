import { Alert } from '../models/index.js';
import idGeneratorService from '../services/idGeneratorService.js';

class AlertRepository {
  async findAll(query, sort, skip, limit) {
    return Alert.find(query)
      .populate('incident_id', 'title status severity')
      .populate('device_id', 'name ip_address current_scenario type')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countAll(query) {
    return Alert.countDocuments(query);
  }

  async aggregate(pipeline) {
    return Alert.aggregate(pipeline);
  }

  async findById(id) {
    return Alert.findById(id)
      .populate('incident_id', 'title status severity')
      .populate('device_id', 'name ip_address current_scenario type');
  }

  async create(data) {
    if (!data.alert_code) {
      data.alert_code = await idGeneratorService.generate('alerts');
    }
    return Alert.create(data);
  }

  async insertMany(data) {
    return Alert.insertMany(data);
  }

  async updateStatusById(id, data) {
    return Alert.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Alert.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return Alert.deleteMany({ _id: { $in: ids } });
  }

  async deleteManyByQuery(query) {
    return Alert.deleteMany(query);
  }
}

export default new AlertRepository();
