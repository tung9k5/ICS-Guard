import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, RefreshToken } from '../models/index.js';
import { handleFailedLogin, handleSuccessfulLogin, registerFailedIpAttempt } from '../services/securityService.js';

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'ics_guard_access_secret_key_2026_@_secure',
    { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || 'ics_guard_refresh_secret_key_2026_@_secure',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  const rawIp = req.ip || req.connection.remoteAddress;
  const ipAddress = rawIp.replace(/^::ffff:/, '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Bad Request', message: 'Username and password are required.' });
  }

  try {
    const user = await User.findOne({ username });

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

    // Calculate refresh token expiry date (7 days default)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

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
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;

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
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 6. Save new refresh token
    await RefreshToken.create({
      userId: user._id,
      token: newRefreshToken,
      expiresAt,
    });

    return res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong.' });
  }
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;

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

export default {
  login,
  refresh,
  logout,
};
