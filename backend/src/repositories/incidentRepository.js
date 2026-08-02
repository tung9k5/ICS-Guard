import { Incident } from '../models/index.js';
import idGeneratorService from '../services/idGeneratorService.js';

class IncidentRepository {
  async findAll(query, sort, skip, limit) {
    return Incident.find(query).sort(sort).skip(skip).limit(limit);
  }

  async countAll(query) {
    return Incident.countDocuments(query);
  }

  async aggregate(pipeline) {
    return Incident.aggregate(pipeline);
  }

  async findById(id) {
    return Incident.findById(id).populate('alert_ids');
  }

  async create(data) {
    if (!data.incident_code) {
      data.incident_code = await idGeneratorService.generate('incidents');
    }
    return Incident.create(data);
  }

  async updateById(id, data) {
    return Incident.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Incident.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return Incident.deleteMany({ _id: { $in: ids } });
  }
}

export default new IncidentRepository();
