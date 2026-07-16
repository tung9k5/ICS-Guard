import bcrypt from 'bcryptjs';
import userRepository from '../repositories/userRepository.js';
import AppError from '../utils/AppError.js';

class UserService {
  async getAll(queryParams, currentUserId) {
    const { search, status, order, role, page = 1, per_page = 10 } = queryParams;

    let query = {};
    if (currentUserId) query._id = { $ne: currentUserId };
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { full_name: searchRegex }
      ];
    }
    if (status) {
      if (status === 'active' || status === 'true') query.is_active = true;
      else if (status === 'inactive' || status === 'false') query.is_active = false;
    }
    if (role) query.role = role;

    const sortOption = order === 'asc' ? { createdAt: 1 } : { createdAt: -1 };
    
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await userRepository.countAll(query);
    const users = await userRepository.findAll(query, sortOption, skip, limitNumber);

    return { users, total, pageNumber, limitNumber };
  }

  async getById(id) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);
    return user;
  }

  async create(data) {
    const { username, password, role, email, full_name, is_active } = data;
    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) throw new AppError('Username already exists', 409);

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await userRepository.create({
      username,
      password_hash,
      email,
      full_name: full_name || '',
      role,
      is_active: is_active !== undefined ? is_active : true,
    });

    return {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      is_active: newUser.is_active,
      createdAt: newUser.createdAt,
    };
  }

  async update(id, data) {
    const { role, is_active, password, full_name, email, avatar, username } = data;
    const user = await userRepository.findById(id, '+password_hash');
    if (!user) throw new AppError('User not found', 404);

    const updateData = {};
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) {
      updateData.is_active = is_active;
      if (is_active) {
        updateData.login_failures = { count: 0, last_failed_at: null, lockout_until: null };
      }
    }
    if (username !== undefined && username !== user.username) {
      const existingUser = await userRepository.findByUsername(username);
      if (existingUser) throw new AppError('Username already exists', 409);
      updateData.username = username;
    }
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await userRepository.updateById(id, updateData);
    return userRepository.findById(id);
  }

  async remove(id, currentUserId) {
    if (currentUserId === id.toString()) throw new AppError('You cannot delete your own account', 400);
    const user = await userRepository.findById(id);
    if (!user) throw new AppError('User not found', 404);
    await userRepository.deleteById(id);
  }

  async removeMany(ids, currentUserId) {
    if (currentUserId && ids.includes(currentUserId.toString())) {
      throw new AppError('Bạn không thể tự xóa tài khoản của chính mình', 400);
    }
    return userRepository.deleteMany(ids);
  }

  async updateProfile(userId, data) {
    const { full_name, email, password, avatar } = data;
    const user = await userRepository.findById(userId, '+password_hash');
    if (!user) throw new AppError('User not found', 404);

    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (password) {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await userRepository.updateById(userId, updateData);
    return userRepository.findById(userId);
  }
}

export default new UserService();
