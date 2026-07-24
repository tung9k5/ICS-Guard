import { jest } from '@jest/globals';
import { register, googleLogin, refresh } from '../src/controllers/authController.js';
import { User, RefreshToken } from '../src/models/index.js';
import jwt from 'jsonwebtoken';
import axios from 'axios';

// No top-level jest.mock needed for axios when using spyOn

describe('Auth Security - Security Requirements', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '127.0.0.1',
      connection: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    process.env.ALLOW_PUBLIC_REGISTER = 'false';
    process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_length_32';
    process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_length_32';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Public Registration Control', () => {
    test('Register public bị chặn khi ALLOW_PUBLIC_REGISTER=false', async () => {
      req.body = { username: 'testuser', email: 'test@example.com', password: 'Password@123' };
      
      await register(req, res);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('vô hiệu hóa')
      }));
    });

    test('Register public được phép khi ALLOW_PUBLIC_REGISTER=true và không tự tạo role admin', async () => {
      process.env.ALLOW_PUBLIC_REGISTER = 'true';
      req.body = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password@123',
        role: 'admin'
      };

      const mockCreatedUser = {
        _id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        role: 'analyst'
      };

      jest.spyOn(User, 'findOne').mockResolvedValue(null);
      jest.spyOn(User, 'create').mockResolvedValue(mockCreatedUser);

      await register(req, res);

      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        role: 'analyst'
      }));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Registration successful'
      }));
    });
  });

  describe('Google Login Restrictions', () => {
    test('Google login không tự tạo user mới nếu không tồn tại sẵn', async () => {
      req.body = { idToken: 'google_id_token' };
      
      jest.spyOn(axios, 'get').mockResolvedValue({
        data: {
          email: 'unregistered@example.com',
          name: 'Unregistered User',
          sub: 'google123'
        }
      });

      jest.spyOn(User, 'findOne').mockResolvedValue(null);

      await googleLogin(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Forbidden',
        message: expect.stringContaining('chưa được cấp phép')
      }));
    });
  });

  describe('Refresh Token Rotation and Reuse Detection', () => {
    test('Refresh token revoked bị từ chối', async () => {
      req.body = { refreshToken: 'some_revoked_refresh_token' };

      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });
      
      jest.spyOn(RefreshToken, 'findOne').mockResolvedValue({
        userId: 'user123',
        token: 'hashed_token',
        revoked: true,
        expiresAt: new Date(Date.now() + 360000)
      });

      jest.spyOn(RefreshToken, 'updateMany').mockResolvedValue({ modifiedCount: 1 });

      await refresh(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Unauthorized',
        message: expect.stringContaining('invalid, revoked, or expired')
      }));
    });

    test('Reuse revoked refresh token bị phát hiện và thu hồi toàn bộ session', async () => {
      req.body = { refreshToken: 'some_revoked_token' };

      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });

      const mockDbToken = {
        userId: 'user123',
        token: 'hashed_token',
        revoked: true,
        expiresAt: new Date(Date.now() + 360000)
      };

      jest.spyOn(RefreshToken, 'findOne').mockResolvedValue(mockDbToken);
      jest.spyOn(RefreshToken, 'updateMany').mockResolvedValue({ modifiedCount: 5 });

      await refresh(req, res);

      expect(RefreshToken.updateMany).toHaveBeenCalledWith(
        { userId: 'user123' },
        { revoked: true }
      );
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
