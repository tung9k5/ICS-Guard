import { jest } from '@jest/globals';
import { login as loginEndpoint } from '../src/controllers/authController.js';
import { User, AuditLog } from '../src/models/index.js';
import bcrypt from 'bcryptjs';

describe('Auth Controller - Login', () => {
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
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('should return 400 if missing username or password', async () => {
    req.body = { username: 'admin' };
    
    await loginEndpoint(req, res);
    
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Bad Request' }));
  });

  test('should return 401 for incorrect password and increment attempts', async () => {
    req.body = { username: 'admin', password: 'wrongpassword' };
    
    const mockUser = {
      _id: 'userid123',
      username: 'admin',
      password_hash: await bcrypt.hash('correctpassword', 1),
      login_failures: { count: 0, last_failed_at: null, lockout_until: null },
      save: jest.fn().mockResolvedValue(true)
    };
    
    jest.spyOn(User, 'findOne').mockResolvedValue(mockUser);
    jest.spyOn(AuditLog, 'create').mockResolvedValue(true);
    
    await loginEndpoint(req, res);
    
    expect(User.findOne).toHaveBeenCalledWith({
      $or: [
        { email: 'admin' },
        { username: 'admin' }
      ]
    });
    expect(mockUser.login_failures.count).toBe(1);
    expect(mockUser.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
