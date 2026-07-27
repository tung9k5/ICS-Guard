import { jest } from '@jest/globals';
import { getAllUsers, getUserById, createUser } from '../src/controllers/userController.js';
import { User } from '../src/models/index.js';
import bcrypt from 'bcryptjs';

describe('User Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 'admin123' },
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:8000')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getAllUsers should retrieve users successfully', async () => {
    const mockUsers = [
      { _id: 'user1', username: 'user1', email: 'user1@test.com', role: 'analyst', is_active: true }
    ];
    jest.spyOn(User, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(User, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockUsers)
    });

    await getAllUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toEqual(mockUsers);
  });

  test('getUserById should return 404 if user not found', async () => {
    req.params.id = 'notfound';
    jest.spyOn(User, 'findById').mockResolvedValue(null);

    await getUserById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('createUser should return 400 if missing fields', async () => {
    req.body = { username: 'testuser' };

    await createUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
