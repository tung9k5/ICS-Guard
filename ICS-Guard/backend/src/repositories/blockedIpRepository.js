import { BlockedIp } from '../models/index.js';

class BlockedIpRepository {
  async findAll(query, sort, skip, limit) {
    return BlockedIp.find(query).sort(sort).skip(skip).limit(limit);
  }

  async countAll(query) {
    return BlockedIp.countDocuments(query);
  }

  async findActive() {
    return BlockedIp.find({ expiresAt: { $gt: new Date() } });
  }

  async deleteByIp(ipAddress) {
    return BlockedIp.deleteOne({ ipAddress });
  }

  async upsertByIp(ipAddress, data) {
    return BlockedIp.findOneAndUpdate(
      { ipAddress },
      data,
      { upsert: true, new: true }
    );
  }
}

export default new BlockedIpRepository();
