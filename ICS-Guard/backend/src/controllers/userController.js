import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { formatPagination } from '../utils/pagination.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

export const getAllUsers = async (req, res) => {
  try {
    const { search, status, order, role, page = 1, per_page = 10 } = req.query;

    let query = {};
    if (req.user && req.user.id) {
      query._id = { $ne: req.user.id };
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { full_name: searchRegex }
      ];
    }

    if (status) {
      if (status === 'active' || status === 'true') {
        query.is_active = true;
      } else if (status === 'inactive' || status === 'false') {
        query.is_active = false;
      }
    }

    if (role) {
      query.role = role;
    }

    let sortOption = {};
    if (order === 'asc') {
      sortOption = { createdAt: 1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(per_page, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await User.countDocuments(query);
    const users = await User.find(query, '-password_hash')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNumber);

    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl || '/api/users'}`;
    const paginated = formatPagination(users, total, pageNumber, limitNumber, baseUrl);

    return paginatedResponse(res, paginated.data, paginated.pagination, 'Lấy danh sách người dùng thành công');
  } catch (error) {
    console.error('GetAllUsers error:', error);
    return errorResponse(res, 'Failed to retrieve users', error.message);
  }
};

export const getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id, '-password_hash');
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }
    return successResponse(res, user, 'Lấy thông tin người dùng thành công');
  } catch (error) {
    console.error('GetUserById error:', error);
    return errorResponse(res, 'Failed to retrieve user', error.message);
  }
};

export const createUser = async (req, res) => {
  const { username, password, role, email, full_name, is_active } = req.body;

  if (!username || !password || !role || !email) {
    return errorResponse(res, 'Username, password, email and role are required', null, 400);
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return errorResponse(res, 'Username already exists', null, 409);
    }

    if (!['admin', 'l1_analyst', 'l2_responder', 'l3_manager', 'ot_operator'].includes(role)) {
      return errorResponse(res, 'Invalid role. Must be admin, l1_analyst, l2_responder, l3_manager, or ot_operator', null, 400);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      password_hash: passwordHash,
      email,
      full_name: full_name || '',
      role,
      is_active: is_active !== undefined ? is_active : true,
    });

    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      is_active: newUser.is_active,
      createdAt: newUser.createdAt,
    };

    return successResponse(res, userResponse, 'Thêm người dùng mới thành công', 201);
  } catch (error) {
    console.error('CreateUser error:', error);
    return errorResponse(res, 'Failed to create user', error.message);
  }
};

export const updateUser = async (req, res) => {
  const { id } = req.params;
  const { role, is_active, password, full_name, email, avatar, username } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    if (role !== undefined) {
      if (!['admin', 'l1_analyst', 'l2_responder', 'l3_manager', 'ot_operator'].includes(role)) {
        return errorResponse(res, 'Invalid role', null, 400);
      }
      user.role = role;
    }

    if (is_active !== undefined) {
      user.is_active = is_active;
      if (is_active) {
        user.login_failures = { count: 0, last_failed_at: null, lockout_until: null };
      }
    }

    if (username !== undefined && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return errorResponse(res, 'Username already exists', null, 409);
      }
      user.username = username;
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;

    if (password) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = await User.findById(id, '-password_hash');
    return successResponse(res, updatedUser, 'Cập nhật người dùng thành công');
  } catch (error) {
    console.error('UpdateUser error:', error);
    return errorResponse(res, 'Failed to update user', error.message);
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Prevent admin from deleting themselves
    if (req.user && req.user.id === user._id.toString()) {
      return errorResponse(res, 'You cannot delete your own account', null, 400);
    }

    await user.deleteOne();
    return successResponse(res, null, 'Xóa người dùng thành công');
  } catch (error) {
    console.error('DeleteUser error:', error);
    return errorResponse(res, 'Failed to delete user', error.message);
  }
};

export const deleteMultipleUsers = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Danh sách ID người dùng không hợp lệ', null, 400);
  }

  try {
    // Prevent admin from deleting themselves in bulk
    if (req.user && ids.includes(req.user.id)) {
      return errorResponse(res, 'Bạn không thể tự xóa tài khoản của chính mình', null, 400);
    }

    const result = await User.deleteMany({ _id: { $in: ids } });
    return successResponse(res, { deletedCount: result.deletedCount }, `Xóa thành công ${result.deletedCount} người dùng`);
  } catch (error) {
    console.error('DeleteMultipleUsers error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách người dùng', error.message);
  }
};

export const updateProfile = async (req, res) => {
  const { id } = req.user; // Assuming req.user is set by authMiddleware
  const { full_name, email, password, avatar } = req.body;

  try {
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    if (full_name !== undefined) user.full_name = full_name;
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;

    if (password) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = await User.findById(id, '-password_hash');
    return res.status(200).json({ message: 'Profile updated successfully.', user: updatedUser });
  } catch (error) {
    console.error('UpdateProfile error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update profile.' });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deleteMultipleUsers,
  updateProfile,
};
