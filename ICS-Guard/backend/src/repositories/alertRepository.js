import { Alert } from '../models/index.js';

class AlertRepository {
  async findAll(query, sort, skip, limit) {
    return Alert.find(query)
      .populate('incident_id', 'title status severity')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countAll(query) {
    return Alert.countDocuments(query);
  }

  async findById(id) {
    return Alert.findById(id).populate('incident_id', 'title status severity');
  }

  async create(data) {
    return Alert.create(data);
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
}

export default new AlertRepository();
