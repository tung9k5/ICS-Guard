import { Rule } from '../models/index.js';

class RuleRepository {
  async findAll(query, sort, skip, limit) {
    return Rule.find(query)
      .populate('created_by', 'username email full_name')
      .sort(sort)
      .skip(skip)
      .limit(limit);
  }

  async countAll(query) {
    return Rule.countDocuments(query);
  }

  async findById(id) {
    return Rule.findById(id).populate('created_by', 'username email full_name');
  }
  
  async findByName(name, excludeId = null) {
    const query = { rule_name: name };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    return Rule.findOne(query);
  }

  async create(data) {
    return Rule.create(data);
  }

  async updateById(id, data) {
    return Rule.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
  }

  async deleteById(id) {
    return Rule.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return Rule.deleteMany({ _id: { $in: ids } });
  }
}

export default new RuleRepository();
