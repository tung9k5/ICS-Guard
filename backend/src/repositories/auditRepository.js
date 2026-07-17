import { AuditLog } from '../models/index.js';

class AuditRepository {
  async findAll(query, sort, skip, limit) {
    return AuditLog.find(query)
      .populate('userId', 'email role username')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();
  }

  async countAll(query) {
    return AuditLog.countDocuments(query);
  }

  async create(data) {
    return AuditLog.create(data);
  }

  async deleteById(id) {
    return AuditLog.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return AuditLog.deleteMany({ _id: { $in: ids } });
  }
}

export default new AuditRepository();
