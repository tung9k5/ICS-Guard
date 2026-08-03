import { jest } from '@jest/globals';
import { refresh } from '../src/controllers/authController.js';
import { User, RefreshToken } from '../src/models/index.js';
import jwt from 'jsonwebtoken';

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
    process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_length_32';
    process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_length_32';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Refresh Token Rotation and Reuse Detection', () => {
    test('Refresh token revoked bị từ chối', async () => {
      req.body = { refreshToken: 'some_revoked_refresh_token' };

      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', is_active: true });
      
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
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', is_active: true });

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
