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

    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { username: searchRegex },
        { email: searchRegex },
        { full_name: searchRegex }
      ];
    }

    if (status) {
      if (status === 'activated') {
        query.isFirstLogin = false;
        query.is_active = true;
        query.deletion_pending = { $ne: true };
        query.status = { $ne: 'locked' };
      } else if (status === 'pending') {
        query.isFirstLogin = true;
        query.deletion_pending = { $ne: true };
        query.status = { $ne: 'locked' };
      } else if (status === 'locked') {
        query.$or = [
          { status: 'locked' },
          { deletion_pending: true },
          { is_active: false }
        ];
      } else if (status === 'active' || status === 'true') {
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
    return errorResponse(res, 'Failed to retrieve users', error.message, 500);
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
    return errorResponse(res, 'Failed to retrieve user', error.message, 500);
  }
};

export const createUser = async (req, res) => {
  const { username, password, role, email, full_name, contactInfo, isAlertEnabled } = req.body;

  if (!email || !role) {
    return errorResponse(res, 'Email và vai trò là bắt buộc', null, 400);
  }

  try {
    const cleanEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      return errorResponse(res, 'Email này đã tồn tại trong hệ thống', null, 409);
    }

    if (!['admin', 'hr_management', 'device_management', 'analyst'].includes(role)) {
      return errorResponse(res, 'Lỗi vai trò không hợp lệ', null, 400);
    }

    // Generate username from email if not supplied, append random suffix if collided
    let finalUsername = username ? username.trim() : '';
    if (!finalUsername) {
      let baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9]/g, '');
      if (!baseUsername) baseUsername = 'user';
      finalUsername = baseUsername;
      let existing = await User.findOne({ username: finalUsername });
      while (existing) {
        const suffix = Math.random().toString(36).substring(2, 6);
        finalUsername = `${baseUsername}_${suffix}`;
        existing = await User.findOne({ username: finalUsername });
      }
    } else {
      let existing = await User.findOne({ username: finalUsername });
      if (existing) {
        const suffix = Math.random().toString(36).substring(2, 6);
        finalUsername = `${finalUsername}_${suffix}`;
      }
    }

    // Generate strong temporary password if not supplied
    let finalPassword = password ? password.trim() : '';
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
      email: cleanEmail,
      full_name: full_name ? full_name.trim() : '',
      role,
      is_active: true,
      status: 'active',
      isFirstLogin,
      temp_password_plain: isFirstLogin ? (generatedTempPassword || finalPassword) : null,
      contactInfo: contactInfo || { telegramChatId: null, telegramUsername: null, phoneNumber: null },
      isAlertEnabled: isAlertEnabled !== undefined ? isAlertEnabled : true
    });

    const userResponse = {
      _id: newUser._id,
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      full_name: newUser.full_name,
      role: newUser.role,
      is_active: newUser.is_active,
      status: newUser.status,
      isFirstLogin: newUser.isFirstLogin,
      temp_password_plain: newUser.temp_password_plain,
      tempPassword: generatedTempPassword,
      contactInfo: newUser.contactInfo,
      isAlertEnabled: newUser.isAlertEnabled,
      createdAt: newUser.createdAt,
    };

    // Emit USER_SYNC event (Sanitized payload)
    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'create', user: userResponse });
    }

    return successResponse(res, userResponse, 'Thêm người dùng mới thành công', 201);
  } catch (error) {
    console.error('CreateUser error:', error);
    return errorResponse(res, 'Không thể tạo người dùng mới: ' + error.message, error.message, 500);
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
        return errorResponse(res, 'Invalid role.', null, 400);
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
    return errorResponse(res, 'Failed to update user', error.message, 500);
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

    if (req.user && req.user.id === user._id.toString()) {
      return errorResponse(res, 'You cannot delete your own account', null, 400);
    }

    // Direct hard-delete for unprovisioned users (isFirstLogin === true)
    if (user.isFirstLogin === true || user.status === 'pending' || force === 'true') {
      backupDeletedUser(user._id.toString(), user.toObject());
      await user.deleteOne();

      const io = socketService.getIo();
      if (io) {
        io.emit('USER_SYNC', { action: 'delete', userId: id });
      }

      // Send Telegram alert notification
      const adminUsername = req.user ? req.user.username : 'Admin';
      sendTelegramAlert(
        `🗑️ [THÔNG BÁO XÓA TÀI KHOẢN]\n\nQuản trị viên *${adminUsername}* đã xóa vĩnh viễn tài khoản *${user.username}* (${user.email} - Vai trò: ${user.role}).`
      );

      return res.status(200).json({ message: 'Tài khoản chưa kích hoạt đã được xóa vĩnh viễn.' });
    }

    user.status = 'locked';
    user.is_active = false;
    user.deletion_pending = true;
    user.deletion_requested_at = new Date();
    user.deletion_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    user.deletion_requested_by = req.user ? req.user.username : 'Admin';
    await user.save();

    await RefreshToken.updateMany({ userId: user._id }, { revoked: true });

    const io = socketService.getIo();
    if (io) {
      io.emit('USER_SYNC', { action: 'update', user });
      io.emit('ACCOUNT_STATUS_CHANGED', { userId: id, status: 'locked', is_active: false });
    }
    socketService.disconnectUserSockets(id);

    // Fetch Deleter (Person A) info for targeted Telegram confirmation
    const deleterId = req.user ? req.user.id : null;
    let deleterChatId = null;
    let adminUsername = 'Admin';

    if (deleterId) {
      const deleterObj = await User.findById(deleterId);
      if (deleterObj) {
        adminUsername = deleterObj.username;
        deleterChatId = deleterObj.contactInfo?.telegramChatId || null;
      }
    }

    const inlineButtons = [
      { text: '❌ Xác Nhận Xóa Ngay', callback_data: `confirm_delete_user:${user._id}` },
      { text: '🔄 Khôi Phục Tài Khoản', callback_data: `restore_user:${user._id}` }
    ];

    const deleterConfirmMsg = 
      `🔒 [YÊU CẦU XÁC NHẬN XÓA TÀI KHOẢN]\n\n` +
      `Kính gửi Quản trị viên *${adminUsername}*,\n` +
      `Bạn vừa thực hiện vô hiệu hóa tài khoản *${user.username}* (${user.email}) và đưa vào danh sách đệm chờ hủy 7 ngày.\n\n` +
      `⏰ HƯỚNG DẪN THAO TÁC XÁC NHẬN:\n` +
      `- Bấm *[Xác Nhận Xóa Ngay]* bên dưới nếu muốn xóa vĩnh viễn tài khoản này ngay lập tức.\n` +
      `- Bấm *[Khôi Phục Tài Khoản]* nếu muốn hủy thao tác.\n` +
      `- Nếu KHÔNG bấm: Hệ thống sẽ tự động xóa vĩnh viễn sau 7 ngày.`;

    // 1. Gửi thông báo xác nhận kèm nút bấm TRỰC TIẾP TỚI TELEGRAM CỦA NGƯỜI XÓA (Person A)
    if (deleterChatId) {
      sendTelegramAlert(deleterConfirmMsg, inlineButtons, deleterChatId);
    } else {
      // Fallback về kênh Telegram chung nếu Người xóa chưa cài đặt Telegram Chat ID cá nhân
      sendTelegramAlert(deleterConfirmMsg, inlineButtons);
    }

    // 2. Gửi thông báo vô hiệu hóa TRỰC TIẾP TỚI TELEGRAM CỦA NGƯỜI BỊ XÓA (Person B)
    if (user.contactInfo?.telegramChatId) {
      sendTelegramAlert(
        `🚨 [THÔNG BÁO TÀI KHOẢN CỦA BẠN ĐÃ BỊ VÔ HIỆU HÓA]\n\n` +
        `Kính gửi *${user.full_name || user.username}*,\n` +
        `Tài khoản *${user.username}* (${user.email}) của bạn vừa bị Quản trị viên *${adminUsername}* vô hiệu hóa và chuyển vào danh sách chờ hủy 7 ngày.\n\n` +
        `⚠️ Phiên làm việc của bạn trên toàn hệ thống đã bị hủy bỏ ngay lập tức.`,
        [],
        user.contactInfo.telegramChatId
      );
    }

    return res.status(200).json({ message: 'Tài khoản đã chuyển sang trạng thái chờ hủy trong 7 ngày và bị khóa tạm thời.', user });
  } catch (error) {
    console.error('DeleteUser error:', error);
    return errorResponse(res, 'Failed to delete user', error.message, 500);
  }
};

export const deleteMultipleUsers = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return errorResponse(res, 'Danh sách ID người dùng không hợp lệ', null, 400);
  }

  try {
    if (req.user && ids.includes(req.user.id)) {
      return errorResponse(res, 'Bạn không thể tự xóa tài khoản của chính mình', null, 400);
    }

    const usersToDelete = await User.find({ _id: { $in: ids } });
    const pendingUserIds = usersToDelete.filter(u => u.isFirstLogin === true || u.status === 'pending').map(u => u._id);
    const activeUserIds = usersToDelete.filter(u => u.isFirstLogin !== true && u.status !== 'pending').map(u => u._id);

    if (pendingUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: pendingUserIds } });
    }

    if (activeUserIds.length > 0) {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await User.updateMany(
        { _id: { $in: activeUserIds } },
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
      await RefreshToken.updateMany({ userId: { $in: activeUserIds } }, { revoked: true });
    }

    const io = socketService.getIo();
    if (io) {
      ids.forEach(id => io.emit('ACCOUNT_STATUS_CHANGED', { userId: id, status: 'locked', is_active: false }));
    }

    return successResponse(res, { modifiedCount: ids.length }, `Đã xử lý xóa ${ids.length} tài khoản.`);
  } catch (error) {
    console.error('DeleteMultipleUsers error:', error);
    return errorResponse(res, 'Lỗi khi xóa danh sách người dùng', error.message, 500);
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
    return errorResponse(res, 'Không thể khôi phục tài khoản', error.message, 500);
  }
};

export const getPendingDeletions = async (req, res) => {
  try {
    const users = await User.find({ deletion_pending: true }, '-password_hash').sort({ deletion_requested_at: -1 });
    return successResponse(res, users, 'Lấy danh sách chờ xác nhận xóa thành công');
  } catch (error) {
    console.error('GetPendingDeletions error:', error);
    return errorResponse(res, 'Lỗi lấy danh sách chờ xóa', error.message, 500);
  }
};

// ----------------------------------------------------
// Dọn dẹp tự động các tài khoản hết hạn 7 ngày chờ hủy
// ----------------------------------------------------
export const cleanupExpiredUsers = async () => {
  try {
    const expiredUsers = await User.find({
      deletion_pending: true,
      deletion_expires_at: { $lte: new Date() }
    });

    if (expiredUsers.length > 0) {
      console.log(`[AutoCleanup] Tìm thấy ${expiredUsers.length} tài khoản hết hạn 7 ngày chờ hủy. Tiến hành xóa vĩnh viễn...`);
      for (const u of expiredUsers) {
        const username = u.username;
        const email = u.email;
        const targetTelegramId = u.contactInfo?.telegramChatId;
        await u.deleteOne();

        // 1. Broadcast to SOC
        sendTelegramAlert(
          `🗑️ [HỆ THỐNG TỰ ĐỘNG XÓA VĨNH VIỄN 7 NGÀY]\n\nTài khoản *${username}* (${email}) đã hết 7 ngày chờ hủy và đã được hệ thống tự động xóa vĩnh viễn khỏi Database.`
        );

        // 2. Direct notification to Target User (Person B)
        if (targetTelegramId) {
          sendTelegramAlert(
            `⛔ [THÔNG BÁO XÓA TÀI KHOẢN VĨNH VIỄN SAU 7 NGÀY]\n\n` +
            `Kính gửi *${u.full_name || username}*,\n` +
            `Tài khoản *${username}* (${email}) của bạn đã hết 7 ngày chờ hủy và vừa được hệ thống tự động XÓA VĨNH VIỄN khỏi cơ sở dữ liệu.`,
            [],
            targetTelegramId
          );
        }
      }
    }
  } catch (err) {
    console.error('[AutoCleanup] Lỗi dọn dẹp tài khoản chờ hủy hết hạn:', err);
  }
};

// Chạy dọn dẹp mỗi 1 giờ
const cleanupInterval = setInterval(cleanupExpiredUsers, 60 * 60 * 1000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

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
  cleanupExpiredUsers,
};
