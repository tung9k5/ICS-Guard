import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import userRepository from '../repositories/userRepository.js';
import authRepository from '../repositories/authRepository.js';
import { handleFailedLogin, handleSuccessfulLogin, registerFailedIpAttempt } from './securityService.js';
import AppError from '../utils/AppError.js';
import { AUTH_CONSTANTS, ROLES, AUTH_PROVIDERS } from '../constants/index.js';

class AuthService {
  generateAccessToken(user) {
    return jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role, 
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin 
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.ACCESS_TOKEN_EXPIRE_MINUTES ? process.env.ACCESS_TOKEN_EXPIRE_MINUTES + 'm' : AUTH_CONSTANTS.JWT_ACCESS_EXPIRY_DEFAULT,
        algorithm: process.env.JWT_ALGORITHM
      }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { 
        expiresIn: AUTH_CONSTANTS.JWT_REFRESH_EXPIRY_DEFAULT,
        algorithm: process.env.JWT_ALGORITHM
      }
    );
  }

  async login(username, password, ipAddress) {
    const user = await userRepository.findByUsername(username);
    
    if (user) {
      const now = new Date();
      if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now) {
        const waitTimeMin = Math.ceil((user.login_failures.lockout_until - now) / 60000);
        await registerFailedIpAttempt(ipAddress);
        throw new AppError(`Account is locked. Please try again after ${waitTimeMin} minute(s).`, 403);
      } else if (user.login_failures && user.login_failures.lockout_until) {
        await userRepository.updateById(user._id, { login_failures: { count: 0, lockout_until: null, last_failed_at: user.login_failures.last_failed_at } });
      }
    }

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      if (user) await handleFailedLogin(user, ipAddress);
      await registerFailedIpAttempt(ipAddress);
      throw new AppError('Invalid username or password.', 401);
    }

    await handleSuccessfulLogin(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return {
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      },
    };
  }

  async refresh(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, {
        algorithms: [process.env.JWT_ALGORITHM]
      });
    } catch (err) {
      throw new AppError('Invalid or expired refresh token.', 401);
    }

    const dbToken = await authRepository.findRefreshToken(refreshToken);

    if (!dbToken || dbToken.revoked || new Date(dbToken.expiresAt) < new Date()) {
      if (dbToken && dbToken.revoked) {
        console.warn(`[Security Alert] Revoked refresh token reuse detected for userId ${decoded.id}.`);
        await authRepository.revokeAllUserTokens(decoded.id);
      }
      throw new AppError('Refresh token is invalid, revoked, or expired.', 401);
    }

    const user = await userRepository.findById(decoded.id);
    const now = new Date();
    const isLocked = user && user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now;

    if (!user || isLocked || !user.is_active) {
      throw new AppError('User is locked, inactive, or no longer exists.', 401);
    }

    await authRepository.revokeRefreshToken(refreshToken);

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      userId: user._id,
      token: newRefreshToken,
      expiresAt,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      }
    };
  }

  async logout(refreshToken) {
    const result = await authRepository.revokeRefreshToken(refreshToken);
    if (result.matchedCount === 0) {
      throw new AppError('Token not found or already revoked.', 404);
    }
  }

  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError('User not found.', 404);
    return user;
  }

  async register({ username, email, password, full_name }) {
    const existingUser = await userRepository.findByEmailOrUsername(email);
    const existingUsername = await userRepository.findByUsername(username);
    
    if (existingUser || existingUsername) {
      throw new AppError('Username or email already exists.', 409);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const newUser = await userRepository.create({
      username,
      email,
      password_hash,
      full_name: full_name || '',
      role: ROLES.CUSTOMER,
      isFirstLogin: false
    });

    const accessToken = this.generateAccessToken(newUser);
    const refreshToken = this.generateRefreshToken(newUser);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      userId: newUser._id,
      token: refreshToken,
      expiresAt,
    });

    return {
      message: 'Registration successful.',
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        isFirstLogin: false
      }
    };
  }

  async googleLogin(idToken) {
    let response;
    try {
      const url = process.env.GOOGLE_OAUTH_TOKENINFO_URL;
      response = await axios.get(`${url}?id_token=${idToken}`);
    } catch (err) {
      throw new AppError('Invalid Google ID token.', 401);
    }
    
    if (response.data.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new AppError('Invalid audience for Google ID token.', 401);
    }

    const { email, name, sub } = response.data;
    let user = await userRepository.findByEmailOrUsername(email);

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const password_hash = await bcrypt.hash(randomPassword, 10);
      
      user = await userRepository.create({
        username: email.split('@')[0] + '_' + sub.substring(0, 4),
        email,
        full_name: name,
        password_hash,
        role: ROLES.CUSTOMER,
        isFirstLogin: false,
        provider_type: AUTH_PROVIDERS.GOOGLE,
        provider_id: sub
      });
    } else if (user.provider_type !== AUTH_PROVIDERS.GOOGLE) {
      await userRepository.updateById(user._id, {
        provider_type: AUTH_PROVIDERS.GOOGLE,
        provider_id: sub
      });
      user.provider_type = AUTH_PROVIDERS.GOOGLE;
      user.provider_id = sub;
    }

    const now = new Date();
    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now) {
      const waitTimeMin = Math.ceil((user.login_failures.lockout_until - now) / 60000);
      throw new AppError(`Account is locked. Please try again after ${waitTimeMin} minute(s).`, 403);
    }

    await handleSuccessfulLogin(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return {
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      },
    };
  }

  getGoogleAuthUrl() {
    const rootUrl = process.env.GOOGLE_OAUTH_AUTH_URL;
    const options = {
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      client_id: process.env.GOOGLE_CLIENT_ID,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
    };
    const qs = new URLSearchParams(options);
    return `${rootUrl}?${qs.toString()}`;
  }

  async googleCallback(code) {
    const url = process.env.GOOGLE_OAUTH_TOKEN_URL;
    const values = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    };
    const qs = new URLSearchParams(values);
    
    let res;
    try {
      res = await axios.post(url, qs.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
    } catch (error) {
      console.error('Google token error', error?.response?.data || error);
      throw new AppError('Failed to fetch Google OAuth tokens', 401);
    }

    const { id_token, access_token } = res.data;
    
    let googleUser;
    try {
      const userInfoUrl = process.env.GOOGLE_OAUTH_USERINFO_URL;
      const gRes = await axios.get(`${userInfoUrl}?alt=json&access_token=${access_token}`, {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      });
      googleUser = gRes.data;
    } catch (error) {
      console.error('Google user info error', error?.response?.data || error);
       throw new AppError('Failed to fetch user', 401);
    }
    
    const { email, name, id: sub } = googleUser;
    let user = await userRepository.findByEmailOrUsername(email);

    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-10);
      const password_hash = await bcrypt.hash(randomPassword, 10);
      
      user = await userRepository.create({
        username: email.split('@')[0] + '_' + sub.substring(0, 4),
        email,
        full_name: name,
        password_hash,
        role: ROLES.CUSTOMER,
        isFirstLogin: false,
        provider_type: AUTH_PROVIDERS.GOOGLE,
        provider_id: sub
      });
    } else if (user.provider_type !== AUTH_PROVIDERS.GOOGLE) {
      await userRepository.updateById(user._id, {
        provider_type: AUTH_PROVIDERS.GOOGLE,
        provider_id: sub
      });
      user.provider_type = AUTH_PROVIDERS.GOOGLE;
      user.provider_id = sub;
    }

    const now = new Date();
    if (user.login_failures && user.login_failures.lockout_until && user.login_failures.lockout_until > now) {
      const waitTimeMin = Math.ceil((user.login_failures.lockout_until - now) / 60000);
      throw new AppError(`Account is locked. Please try again after ${waitTimeMin} minute(s).`, 403);
    }

    await handleSuccessfulLogin(user);

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await authRepository.createRefreshToken({
      userId: user._id,
      token: refreshToken,
      expiresAt,
    });

    return {
      message: 'Login successful.',
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        isFirstLogin: user.isFirstLogin === undefined ? true : user.isFirstLogin,
      },
    };
  }
}

export default new AuthService();
