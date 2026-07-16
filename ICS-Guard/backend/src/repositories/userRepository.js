import { User } from '../models/index.js';

class UserRepository {
  async findAll(query, sort, skip, limit, projection = '-password_hash') {
    return User.find(query, projection).sort(sort).skip(skip).limit(limit).lean();
  }

  async countAll(query) {
    return User.countDocuments(query);
  }

  async findById(id, projection = '-password_hash') {
    return User.findById(id, projection);
  }

  async findByUsername(username) {
    return User.findOne({ username });
  }

  async findByEmailOrUsername(input) {
    return User.findOne({
      $or: [{ email: input }, { username: input }]
    });
  }
  
  async findByEmails(emails, projection) {
    return User.find({ email: { $in: emails } }).select(projection).lean();
  }
  
  async findByRole(role, projection) {
    return User.find({ role }).select(projection);
  }

  async create(data) {
    return User.create(data);
  }

  async updateById(id, data) {
    const user = await User.findById(id);
    if (!user) return null;
    
    Object.assign(user, data);
    return user.save();
  }

  async deleteById(id) {
    return User.findByIdAndDelete(id);
  }

  async deleteMany(ids) {
    return User.deleteMany({ _id: { $in: ids } });
  }
}

export default new UserRepository();
