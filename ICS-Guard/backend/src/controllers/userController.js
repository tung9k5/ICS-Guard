import bcrypt from 'bcryptjs';
import { User, RefreshToken } from '../models/index.js';
import socketService from '../services/socketService.js';
import { sendTelegramAlert, backupDeletedUser } from '../services/telegramService.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import { formatPagination } from '../utils/pagination.js';

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
  const { username, password, role, email, full_name, contactInfo, isAlertEnabled } = req.body;

  if (!email || !role) {
    return errorResponse(res, 'Email and role are required', null, 400);
  }

  try {
    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return errorResponse(res, 'Email already exists', null, 409);
    }

    if (!['admin', 'hr_management', 'device_management', 'analyst'].includes(role)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid role. Must be admin, hr_management, device_management, or analyst.' });
    }

    // Generate username from email if not supplied
    let finalUsername = username;
    if (!finalUsername) {
      let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      finalUsername = baseUsername;
      let counter = 1;
      while (await User.findOne({ username: finalUsername })) {
        finalUsername = `${baseUsername}${counter}`;
        counter++;
      }
    } else {
      const existingUser = await User.findOne({ username: finalUsername });
      if (existingUser) {
        return errorResponse(res, 'Username already exists', null, 409);
      }
    }

    // Generate strong temporary password if not supplied
    let finalPassword = password;
    let generatedTempPassword = null;
    let isFirstLogin = true;

    if (!finalPassword) {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
      finalPassword = '';
      for (let i = 0; i < 12; i++) {
        finalPassword += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      generatedTempPassword = finalPassword;
    } else {
      isFirstLogin = false;
    }

    const passwordHash = await bcrypt.hash(finalPassword, 10);
    const newUser = await User.create({
      username: finalUsername,
      password_hash: passwordHash,
      email,
      full_name: full_name || '',
      role,
      is_active: true,
      isFirstLogin,
      contactInfo: contactInfo || { telegramChatId: null, telegramUsername: null, phoneNumber: null },
      isAlertEnabled: isAlertEnabled !== undefined ? isAlertEnabled : true
    });

    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      is_active: newUser.is_active,
      isFirstLogin: newUser.isFirstLogin,
      contactInfo: newUser.contactInfo,
      isAlertEnabled: newUser.isAlertEnabled,
      createdAt: newUser.createdAt,
    };

    // Emit USER_SYNC event (Sanitized payload)
    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'create', user: userResponse });
    }

    if (generatedTempPassword) {
      userResponse.tempPassword = generatedTempPassword;
    }

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
      if (!['admin', 'hr_management', 'device_management', 'analyst'].includes(role)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Invalid role.' });
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
    if (req.body.contactInfo !== undefined) user.contactInfo = req.body.contactInfo;
    if (req.body.isAlertEnabled !== undefined) user.isAlertEnabled = req.body.isAlertEnabled;

    if (password) {
      user.password_hash = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = await User.findById(id, '-password_hash');

    // Emit USER_SYNC event
    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'update', user: updatedUser });
    }
    if (is_active === false || password) {
      await RefreshToken.updateMany({ userId: user._id }, { revoked: true });
      socketService.disconnectUserSockets(id);
    }

    return res.status(200).json({ message: 'User updated successfully.', user: updatedUser });
  } catch (error) {
    console.error('UpdateUser error:', error);
    return errorResponse(res, 'Failed to update user', error.message);
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  const { force } = req.query;

  try {
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    // Prevent admin from deleting themselves
    if (req.user && req.user.id === user._id.toString()) {
      return errorResponse(res, 'You cannot delete your own account', null, 400);
    }

    // Pending/unverified users or force hard-delete
    if (user.status === 'pending' || force === 'true') {
      backupDeletedUser(user._id.toString(), user.toObject());
      await user.deleteOne();

      const io = socketService.getIo();
      if (io) {
        io.emit('USER_SYNC', { action: 'delete', userId: id });
      }
      return res.status(200).json({ message: 'Tài khoản đã được xóa vĩnh viễn.' });
    }

    // Active user: 2-step soft delete (lock account & wait 7 days for confirmation)
    user.status = 'locked';
    user.is_active = false;
    user.deletion_pending = true;
    user.deletion_requested_at = new Date();
    user.deletion_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.deletion_requested_by = req.user ? req.user.username : 'Admin';
    await user.save();

    // Instantly revoke all refresh tokens for this user
    await RefreshToken.updateMany({ userId: user._id }, { revoked: true });

    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'update', user });
      io.emit('ACCOUNT_STATUS_CHANGED', { userId: id, status: 'locked', is_active: false });
    }
    socketService.disconnectUserSockets(id);

    // Send Telegram notification to target user if chat ID exists
    if (user.contactInfo?.telegramChatId) {
      sendTelegramAlert(
        `⚠️ *THÔNG BÁO TÀI KHOẢN VÔ HIỆU HÓA*\n\nTài khoản *${user.username}* của bạn đã bị tạm thời vô hiệu hóa bởi Quản trị viên. Phiên làm việc của bạn sẽ kết thúc sau 60 giây.`,
        [],
        user.contactInfo.telegramChatId
      );
    }

    // Send/update batch approval message to Admin Telegram
    const operator = req.user ? await User.findById(req.user.id) : null;
    const adminChatId = operator?.contactInfo?.telegramChatId || process.env.TELEGRAM_CHAT_ID;

    if (adminChatId) {
      const pendingUsers = await User.find({ deletion_pending: true });
      const pendingNames = pendingUsers.map(u => u.username).join(', ');
      const alertMsg = `⚠️ *YÊU CẦU XÁC NHẬN XÓA TÀI KHOẢN (${pendingUsers.length})*\n\nTài khoản mới yêu cầu xóa: *${user.username}*\nDanh sách chờ xóa (${pendingUsers.length}): ${pendingNames}\nNgười thực hiện: *${req.user ? req.user.username : 'Admin'}*\nHạn xác nhận: 7 ngày (Tự động khôi phục nếu không xác nhận).\n\nNhấn nút bên dưới để xác nhận xóa:`;
      const inlineButtons = [
        { text: `✅ Xác Nhận Xóa Tất Cả (${pendingUsers.length})`, callback_data: `confirm_bulk_delete:${pendingUsers.length}` },
        { text: '🔄 Hủy lệnh xóa mới nhất', callback_data: `undo_delete:${user._id.toString()}` }
      ];
      await sendTelegramAlert(alertMsg, inlineButtons, adminChatId);
    }

    return res.status(200).json({ message: 'Tài khoản đã chuyển sang trạng thái chờ hủy trong 7 ngày và bị khóa tạm thời.', user });
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

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await User.updateMany(
      { _id: { $in: ids } },
      {
        $set: {
          status: 'locked',
          is_active: false,
          deletion_pending: true,
          deletion_requested_at: new Date(),
          deletion_expires_at: expiresAt,
          deletion_requested_by: req.user ? req.user.username : 'Admin'
        }
      }
    );

    // Instantly revoke refresh tokens for all affected users
    await RefreshToken.updateMany({ userId: { $in: ids } }, { revoked: true });

    const io = socketService.getIo();
    if (io) {
      ids.forEach(id => io.emit('ACCOUNT_STATUS_CHANGED', { userId: id, status: 'locked', is_active: false }));
    }

    return successResponse(res, { modifiedCount: result.modifiedCount }, `Đã chuyển ${result.modifiedCount} tài khoản vào danh sách chờ hủy 7 ngày`);
  } catch (error) {
    console.error('DeleteMultipleUsers error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách người dùng', error.message);
  }
};

export const updateProfile = async (req, res) => {
  const { id } = req.user;
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

export const restoreUser = async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      return errorResponse(res, 'User not found', null, 404);
    }

    user.deletion_pending = false;
    user.status = 'active';
    user.is_active = true;
    user.deletion_requested_at = null;
    user.deletion_expires_at = null;
    user.deletion_requested_by = null;
    await user.save();

    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'update', user });
      io.emit('ACCOUNT_STATUS_CHANGED', { userId: id, status: 'active', is_active: true });
    }

    return successResponse(res, user, 'Khôi phục tài khoản thành công');
  } catch (error) {
    console.error('RestoreUser error:', error);
    return errorResponse(res, 'Không thể khôi phục tài khoản', error.message);
  }
};

export const getPendingDeletions = async (req, res) => {
  try {
    const users = await User.find({ deletion_pending: true }, '-password_hash').sort({ deletion_requested_at: -1 });
    return successResponse(res, users, 'Lấy danh sách chờ xác nhận xóa thành công');
  } catch (error) {
    console.error('GetPendingDeletions error:', error);
    return errorResponse(res, 'Lỗi lấy danh sách chờ xóa', error.message);
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
  restoreUser,
  getPendingDeletions,
};

