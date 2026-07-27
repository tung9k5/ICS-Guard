import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
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
    });

    // Handle brute force user lockout check
    if (user) {
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

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
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
  const { newPassword, email, telegramChatId } = req.body;
  const userId = req.user.id; // Từ authMiddleware

  if (!newPassword || !email) {
    return res.status(400).json({ error: 'Bad Request', message: 'Mật khẩu mới và email là bắt buộc.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'Không tìm thấy tài khoản.' });
    }

    // Băm mật khẩu mới
    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.email = email;
    
    // Cập nhật thông tin liên hệ
    if (!user.contactInfo) {
      user.contactInfo = {};
    }
    user.contactInfo.telegramChatId = telegramChatId || null;
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
    return res.status(500).json({ error: 'Internal Server Error', message: 'Lỗi thiết lập onboarding.' });
  }
};

export const register = async (req, res) => {
  const allowPublic = process.env.ALLOW_PUBLIC_REGISTER === 'true';
  if (!allowPublic) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Tính năng đăng ký tài khoản công khai bị vô hiệu hóa. Vui lòng liên hệ bộ phận nhân sự (HR) để tạo tài khoản.'
    });
  }

  const { username, email, password, full_name, role } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Username, email, and password are required.' });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Username or email already exists.' });
    }

    let finalRole = role || 'analyst';
    if (finalRole === 'admin') {
      finalRole = 'analyst';
    }

    finalRole = normalizeRole(finalRole);

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      password_hash: passwordHash,
      email,
      full_name: full_name || '',
      role: finalRole,
      is_active: true,
      isFirstLogin: false
    });

    return res.status(201).json({
      message: 'Registration successful',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Failed to register.' });
  }
};

export const googleLogin = async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Bad Request', message: 'Google ID token is required.' });
  }

  try {
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
    const { email, name, sub } = response.data; // `sub` is Google user ID

    let user = await User.findOne({ email });

    if (!user) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Tài khoản Google này chưa được cấp phép trong hệ thống. Vui lòng liên hệ bộ phận nhân sự (HR).'
      });
    }

    // Lock check
    const now = new Date();
    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now) {
      const waitTimeMin = Math.ceil((user.login_failures.lockout_until - now) / 60000);
      return res.status(403).json({
        error: 'Forbidden',
        message: `Account is locked. Please try again after ${waitTimeMin} minute(s).`,
      });
    }

    await handleSuccessfulLogin(user);

    const canonicalRole = normalizeRole(user.role);
    if (canonicalRole && canonicalRole !== user.role) {
      user.role = canonicalRole;
      await user.save();
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

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
        email: user.email,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      },
    });

  } catch (error) {
    console.error('Google login error:', error.response?.data || error);
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Google ID token.' });
  }
};

// ------------------------------------
// Gửi mã OTP xác thực Telegram
// ------------------------------------
export const sendTelegramOtp = async (req, res) => {
  const { telegramChatId } = req.body;

  if (!telegramChatId) {
    return res.status(400).json({ error: 'Bad Request', message: 'telegramChatId là bắt buộc.' });
  }

  // Kiểm tra gửi quá nhanh (còn OTP cũ chưa hết hạn và mới gửi < 30s)
  const existing = telegramOtpStore.get(String(telegramChatId));
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
      `🔐 *ICS\-GUARD XÁC THỰC*\n\nMã xác nhận liên kết tài khoản của bạn là:\n\n*${code}*\n\n⏰ Mã này có hiệu lực trong *5 phút*\. Không chia sẻ mã này với bất kỳ ai\.`,
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
  register,
  googleLogin,
};
