import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { User, RefreshToken } from '../models/index.js';
import { handleFailedLogin, handleSuccessfulLogin, registerFailedIpAttempt } from '../services/securityService.js';

const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      username: user.username, 
      role: user.role, 
      isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin 
    },
    process.env.JWT_SECRET || 'ics_guard_access_secret_key_2026_@_secure',
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '30d' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || 'ics_guard_refresh_secret_key_2026_@_secure',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '365d' }
  );
};

export const login = async (req, res) => {
  console.log('[Login Request Body]', req.body);
  const emailInput = req.body.email;
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
      token: refreshToken,
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
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'ics_guard_refresh_secret_key_2026_@_secure');
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired refresh token.' });
    }

    // 2. Find token in DB
    const dbToken = await RefreshToken.findOne({ token: refreshToken });

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
      token: newRefreshToken,
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
      { token: refreshToken },
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
  console.log('[Register Request Body]', req.body);
  const { username, email, password, full_name } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Username, email and password are required.' });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Conflict', message: 'Username or email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password_hash,
      full_name: full_name || '',
      role: 'admin',
      isFirstLogin: false
    });

    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await RefreshToken.create({
      userId: newUser._id,
      token: refreshToken,
      expiresAt,
    });

    return res.status(201).json({
      message: 'Registration successful.',
      accessToken,
      refreshToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isFirstLogin: false
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
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
      // Create user if not exists
      // Generate a random password since they login with Google
      const randomPassword = Math.random().toString(36).slice(-10);
      const password_hash = await bcrypt.hash(randomPassword, 10);
      
      user = await User.create({
        username: email.split('@')[0] + '_' + sub.substring(0, 4),
        email,
        full_name: name,
        password_hash,
        role: 'admin', // default role, adjust if needed
        isFirstLogin: false
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

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 365);

    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
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

export default {
  login,
  refresh,
  logout,
  me,
  setupOnboarding,
  register,
  googleLogin,
};
