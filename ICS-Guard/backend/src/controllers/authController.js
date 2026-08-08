import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import { User, RefreshToken } from '../models/index.js';
import { handleFailedLogin, handleSuccessfulLogin, registerFailedIpAttempt } from '../services/securityService.js';
import { sendTelegramAlert } from '../services/telegramService.js';
import { normalizeRole } from '../utils/roles.js';

const hashToken = (token) => {
  if (!token) return '';
  return crypto.createHash('sha256').update(token).digest('hex');
};

// -----------------------------------------------
// In-memory OTP store (không cần Redis)
// Format: { chatId: { code, expiresAt, attempts } }
// -----------------------------------------------
const telegramOtpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;    // 5 phút
const OTP_MAX_ATTEMPTS = 5;           // Tối đa 5 lần nhập sai

// Dọn OTP hết hạn mỗi 10 phút
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of telegramOtpStore.entries()) {
    if (now > val.expiresAt) telegramOtpStore.delete(key);
  }
}, 10 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      telegramChatId: user.contactInfo ? user.contactInfo.telegramChatId : null
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '30d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '365d' }
  );
};

export const login = async (req, res) => {
  const rawUsername = req.body.username || req.body.username_or_email || req.body.email;
  console.log('[Login Request] Attempt by:', typeof rawUsername === 'string' ? rawUsername.trim() : rawUsername);
  const emailInput = typeof rawUsername === 'string' ? rawUsername.trim() : rawUsername;
  const { password } = req.body;
  const rawIp = req.ip || req.connection.remoteAddress;
  const ipAddress = rawIp.replace(/^::ffff:/, '');

  if (!emailInput || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Email and password are required.' });
  }

  try {
    // Support logging in by either email or username
    const user = await User.findOne({
      $or: [
        { email: emailInput },
        { username: emailInput }
      ]
    }).select('+password_hash');

    // Handle brute force user lockout check
    if (user) {
      if (user.status === 'locked' || user.is_active === false || user.deletion_pending === true) {
        return res.status(403).json({
          error: 'ACCOUNT_DEACTIVATED',
          message: 'Tài khoản của bạn đã bị tạm thời vô hiệu hóa hoặc bị khóa bởi Quản trị viên.',
        });
      }

      const now = new Date();
      if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now) {
        const waitTimeMin = Math.ceil((user.login_failures.lockout_until - now) / 60000);
        await registerFailedIpAttempt(ipAddress); // Log attempt against IP even if user is locked
        return res.status(403).json({
          error: 'Forbidden',
          message: `Account is locked. Please try again after ${waitTimeMin} minute(s).`,
        });
      } else if (user.login_failures && user.login_failures.lockout_until) {
        // Lock duration expired, reset status
        user.login_failures.lockout_until = null;
        user.login_failures.count = 0;
        await user.save();
      }
    }

    if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
      // Failed login
      if (user) {
        await handleFailedLogin(user, ipAddress);
      }
      await registerFailedIpAttempt(ipAddress);

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password.',
      });
    }

    // Successful login
    const canonicalRole = normalizeRole(user.role);
    if (canonicalRole && canonicalRole !== user.role) {
      user.role = canonicalRole;
      await user.save();
    }
    await handleSuccessfulLogin(user);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Calculate refresh token expiry date (365 days default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    // Save refresh token to database
    await RefreshToken.create({
      userId: user._id,
      token: hashToken(refreshToken),
      expiresAt,
    });

    return res.status(200).json({
      message: 'Login successful.',
      accessToken,
      refreshToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const refresh = async (req, res) => {
  const refreshToken = req.body.refreshToken || req.body.refresh_token;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Bad Request', message: 'Refresh token is required.' });
  }

  try {
    // 1. Verify token signature & expiry
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token.' });
    }

    // 2. Find token in DB
    const dbToken = await RefreshToken.findOne({ token: hashToken(refreshToken) });

    // Token reuse detection (Security best practice)
    if (!dbToken || dbToken.revoked || new Date(dbToken.expiresAt) < new Date()) {
      if (dbToken && dbToken.revoked) {
        console.warn(`[Security Alert] Revoked refresh token reuse detected for userId ${decoded.id}. Revoking all user sessions.`);
        await RefreshToken.updateMany({ userId: decoded.id }, { revoked: true });
      }
      return res.status(401).json({ error: 'Unauthorized', message: 'Refresh token is invalid, revoked, or expired.' });
    }

    // 3. Find User
    const user = await User.findById(decoded.id);

    const now = new Date();
    const isLocked = user && user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now;

    if (!user || isLocked || !user.is_active) {
      return res.status(401).json({ error: 'Unauthorized', message: 'User is locked, inactive, or no longer exists.' });
    }

    const canonicalRole = normalizeRole(user.role);
    if (canonicalRole && canonicalRole !== user.role) {
      user.role = canonicalRole;
      await user.save();
    }

    // 4. Revoke the current refresh token (rotation)
    dbToken.revoked = true;
    await dbToken.save();

    // 5. Generate new pair
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    // 6. Save new refresh token
    await RefreshToken.create({
      userId: user._id,
      token: hashToken(newRefreshToken),
      expiresAt,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const logout = async (req, res) => {
  const refreshToken = req.body.refreshToken || req.body.refresh_token;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Bad Request', message: 'Refresh token is required to log out.' });
  }

  try {
    // Revoke refresh token
    const result = await RefreshToken.updateOne(
      { token: hashToken(refreshToken) },
      { revoked: true }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Token not found or already revoked.' });
    }

    return res.status(200).json({ message: 'Successfully logged out.' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }
    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const setupOnboarding = async (req, res) => {
  const { newPassword, email, telegramChatId, username } = req.body;
  const userId = req.user.id; // Từ authMiddleware

  if (!newPassword) {
    return res.status(400).json({ error: 'Bad Request', message: 'Mật khẩu mới là bắt buộc.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'Không tìm thấy tài khoản.' });
    }

    // 1. Kiểm tra trùng lặp username
    if (username && username.trim() && username.trim() !== user.username) {
      const cleanUsername = username.trim();
      const takenUser = await User.findOne({ username: cleanUsername, _id: { $ne: userId } });
      if (takenUser) {
        return res.status(409).json({ error: 'Conflict', message: `Tên đăng nhập "${cleanUsername}" đã được sử dụng bởi tài khoản khác trong hệ thống.` });
      }
      user.username = cleanUsername;
    }

    // 2. Kiểm tra trùng lặp email
    if (email && email.trim() && email.trim().toLowerCase() !== user.email) {
      const cleanEmail = email.trim().toLowerCase();
      const takenEmail = await User.findOne({ email: cleanEmail, _id: { $ne: userId } });
      if (takenEmail) {
        return res.status(409).json({ error: 'Conflict', message: `Địa chỉ Email "${cleanEmail}" đã được sử dụng bởi tài khoản khác trong hệ thống.` });
      }
      user.email = cleanEmail;
    }

    // 3. Kiểm tra trùng lặp Telegram Chat ID
    if (telegramChatId && String(telegramChatId).trim()) {
      const cleanChatId = String(telegramChatId).trim();
      const takenTelegram = await User.findOne({
        'contactInfo.telegramChatId': cleanChatId,
        _id: { $ne: userId }
      });
      if (takenTelegram) {
        return res.status(409).json({ error: 'Conflict', message: `ID Telegram "${cleanChatId}" đã được liên kết với một tài khoản khác trong hệ thống.` });
      }
      if (!user.contactInfo) user.contactInfo = {};
      user.contactInfo.telegramChatId = cleanChatId;
    }

    // Băm mật khẩu mới
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.isFirstLogin = false;

    await user.save();

    // Tạo token mới phản ánh thông tin cập nhật
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return res.status(200).json({
      message: 'Thiết lập onboarding thành công.',
      accessToken,
      refreshToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isFirstLogin: false
      }
    });

  } catch (error) {
    console.error('SetupOnboarding error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Lỗi thiết lập onboarding: ' + error.message });
  }
};



// ------------------------------------
// Gửi mã OTP xác thực Telegram
// ------------------------------------
export const sendTelegramOtp = async (req, res) => {
  const { telegramChatId } = req.body;
  const userId = req.user ? req.user.id : null;

  if (!telegramChatId || !String(telegramChatId).trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'telegramChatId là bắt buộc.' });
  }

  const cleanChatId = String(telegramChatId).trim();

  // Kiểm tra nếu Telegram Chat ID đã được đăng ký cho tài khoản khác
  if (userId) {
    const takenTelegram = await User.findOne({
      'contactInfo.telegramChatId': cleanChatId,
      _id: { $ne: userId }
    });
    if (takenTelegram) {
      return res.status(409).json({ error: 'Conflict', message: `ID Telegram "${cleanChatId}" đã được liên kết với một tài khoản khác trong hệ thống.` });
    }
  }

  // Kiểm tra gửi quá nhanh (còn OTP cũ chưa hết hạn và mới gửi < 30s)
  const existing = telegramOtpStore.get(cleanChatId);
  if (existing && Date.now() < existing.expiresAt && Date.now() < existing.sentAt + 30_000) {
    const waitSec = Math.ceil((existing.sentAt + 30_000 - Date.now()) / 1000);
    return res.status(429).json({ error: 'Too Many Requests', message: `Vui lòng đợi ${waitSec} giây trước khi gửi lại.` });
  }

  // Tạo mã OTP 6 số
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + OTP_TTL_MS;
  const sentAt = Date.now();

  telegramOtpStore.set(String(telegramChatId), { code, expiresAt, sentAt, attempts: 0 });

  try {
    console.log(`[AuthController] Gửi OTP (masked) đến Chat ID: ${telegramChatId}`);

    const sent = await sendTelegramAlert(
      `*ICS\\-GUARD XÁC THỰC*\n\nMã xác nhận liên kết tài khoản của bạn là:\n\n*${code}*\n\nMã này có hiệu lực trong *5 phút*\\. Không chia sẻ mã này với bất kỳ ai\\.`,
      [],
      telegramChatId
    );

    if (!sent) {
      telegramOtpStore.delete(String(telegramChatId));
      return res.status(500).json({
        error: 'Telegram Error',
        message: 'Không thể gửi tin nhắn. Hãy đảm bảo bạn đã chat \'/start\' với Bot trước.'
      });
    }

    return res.status(200).json({ status: 'success', message: 'Mã xác nhận đã được gửi tới Telegram của bạn.' });
  } catch (error) {
    console.error('[AuthController] Lỗi gửi OTP Telegram:', error);
    telegramOtpStore.delete(String(telegramChatId));
    return res.status(500).json({ error: 'Internal Server Error', message: 'Gặp lỗi khi gửi mã xác nhận.' });
  }
};

// ------------------------------------
// Xác minh mã OTP Telegram
// ------------------------------------
export const verifyTelegramOtp = async (req, res) => {
  const { telegramChatId, code } = req.body;

  if (!telegramChatId || !code) {
    return res.status(400).json({ error: 'Bad Request', message: 'telegramChatId và code là bắt buộc.' });
  }

  const record = telegramOtpStore.get(String(telegramChatId));

  if (!record) {
    return res.status(400).json({ error: 'Bad Request', message: 'Mã xác nhận không tồn tại hoặc đã hết hạn. Vui lòng gửi lại.' });
  }

  if (Date.now() > record.expiresAt) {
    telegramOtpStore.delete(String(telegramChatId));
    return res.status(400).json({ error: 'OTP Expired', message: 'Mã xác nhận đã hết hạn (5 phút). Vui lòng gửi lại.' });
  }

  record.attempts += 1;
  if (record.attempts > OTP_MAX_ATTEMPTS) {
    telegramOtpStore.delete(String(telegramChatId));
    return res.status(429).json({ error: 'Too Many Attempts', message: 'Quá nhiều lần nhập sai. Vui lòng yêu cầu mã mới.' });
  }

  if (record.code !== String(code).trim()) {
    const left = OTP_MAX_ATTEMPTS - record.attempts;
    return res.status(400).json({ error: 'Invalid OTP', message: `Mã không đúng. Còn ${left} lần thử.` });
  }

  // Xác thực thành công — xóa OTP khỏi store
  telegramOtpStore.delete(String(telegramChatId));
  return res.status(200).json({ status: 'success', message: 'Xác thực Telegram thành công!' });
};

export default {
  login,
  refresh,
  logout,
  me,
  setupOnboarding,
  sendTelegramOtp,
  verifyTelegramOtp,
};

