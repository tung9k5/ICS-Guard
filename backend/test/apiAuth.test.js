import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import express from 'express';

// Mock mqttService to prevent real connections or publish calls
jest.unstable_mockModule('../src/services/mqttService.js', () => ({
  publishMqtt: jest.fn().mockReturnValue(true),
  connectMqtt: jest.fn()
}));

const { User } = await import('../src/models/index.js');
const { default: deviceAuthMiddleware } = await import('../src/middlewares/deviceAuthMiddleware.js');
const { default: simulatorAuthMiddleware } = await import('../src/middlewares/simulatorAuthMiddleware.js');
const { default: simulatorOrUserAuthMiddleware } = await import('../src/middlewares/simulatorOrUserAuthMiddleware.js');
const { default: attackAuthMiddleware } = await import('../src/middlewares/attackAuthMiddleware.js');

describe('API Authorization Middlewares', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    process.env.DEVICE_API_KEY = 'test_device_key';
    process.env.SIMULATOR_API_KEY = 'test_simulator_key';
    process.env.ATTACK_SIMULATOR_API_KEY = 'test_attack_key';
    process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_length_32';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('deviceAuthMiddleware', () => {
    test('should allow access with correct device API key', () => {
      req.headers['x-device-api-key'] = 'test_device_key';
      deviceAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block access with missing key', () => {
      deviceAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unauthorized' }));
      expect(next).not.toHaveBeenCalled();
    });

    test('should block access with invalid key', () => {
      req.headers['x-device-api-key'] = 'wrong_key';
      deviceAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 500 if env variable is not set', () => {
      delete process.env.DEVICE_API_KEY;
      deviceAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('simulatorAuthMiddleware', () => {
    test('should allow access with correct simulator API key', () => {
      req.headers['x-simulator-api-key'] = 'test_simulator_key';
      simulatorAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block access with invalid key', () => {
      req.headers['x-simulator-api-key'] = 'wrong_key';
      simulatorAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should return 500 if env variable is not set', () => {
      delete process.env.SIMULATOR_API_KEY;
      simulatorAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('simulatorOrUserAuthMiddleware', () => {
    test('should allow access with correct simulator key', async () => {
      req.headers['x-simulator-api-key'] = 'test_simulator_key';
      await simulatorOrUserAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should allow access with valid JWT token', async () => {
      req.headers['authorization'] = 'Bearer valid_jwt_token';
      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'analyst' });

      await simulatorOrUserAuthMiddleware(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid_jwt_token', process.env.JWT_ACCESS_SECRET);
      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block access if both simulator key and JWT token are missing', async () => {
      await simulatorOrUserAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should block access if JWT verify fails', async () => {
      req.headers['authorization'] = 'Bearer invalid_token';
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await simulatorOrUserAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('attackAuthMiddleware', () => {
    test('should allow access with attack simulator key in non-production', async () => {
      req.headers['x-attack-simulator-api-key'] = 'test_attack_key';
      await attackAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block access with attack simulator key in production', async () => {
      process.env.NODE_ENV = 'production';
      req.headers['x-attack-simulator-api-key'] = 'test_attack_key';
      await attackAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('should allow access with valid JWT token and allowed role', async () => {
      req.headers['authorization'] = 'Bearer valid_jwt_token';
      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'analyst' });

      await attackAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should block access with valid JWT token but disallowed role', async () => {
      req.headers['authorization'] = 'Bearer valid_jwt_token';
      jest.spyOn(jwt, 'verify').mockReturnValue({ id: 'user123' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'viewer' });

      await attackAuthMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Attack Route Integration - /api/attacks/launch', () => {
    let app;

    beforeAll(async () => {
      app = express();
      app.use(express.json());
      const { default: attackRoutes } = await import('../src/routes/attackRoutes.js');
      app.use('/api/attacks', attackRoutes);
    });

    test('Anonymous gọi attack launch bị 401', async () => {
      const res = await request(app)
        .post('/api/attacks/launch')
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(401);
    });

    test('Attack simulator key đúng được phép trong development', async () => {
      process.env.NODE_ENV = 'development';
      const res = await request(app)
        .post('/api/attacks/launch')
        .set('x-attack-simulator-api-key', 'test_attack_key')
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(200);
    });

    test('Attack simulator key đúng bị chặn trong production', async () => {
      process.env.NODE_ENV = 'production';
      const res = await request(app)
        .post('/api/attacks/launch')
        .set('x-attack-simulator-api-key', 'test_attack_key')
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(401);
    });

    test('JWT role hr_management bị 403', async () => {
      const token = jwt.sign({ id: 'user123', role: 'hr_management' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'hr_management' });

      const res = await request(app)
        .post('/api/attacks/launch')
        .set('Authorization', `Bearer ${token}`)
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(403);
    });

    test('JWT role admin được phép', async () => {
      const token = jwt.sign({ id: 'user123', role: 'admin' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'admin' });

      const res = await request(app)
        .post('/api/attacks/launch')
        .set('Authorization', `Bearer ${token}`)
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(200);
    });

    test('JWT role device_management được phép', async () => {
      const token = jwt.sign({ id: 'user123', role: 'device_management' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'device_management' });

      const res = await request(app)
        .post('/api/attacks/launch')
        .set('Authorization', `Bearer ${token}`)
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(200);
    });

    test('JWT role analyst được phép', async () => {
      const token = jwt.sign({ id: 'user123', role: 'analyst' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1h' });
      jest.spyOn(User, 'findById').mockResolvedValue({ _id: 'user123', role: 'analyst' });

      const res = await request(app)
        .post('/api/attacks/launch')
        .set('Authorization', `Bearer ${token}`)
        .send({ device_id: 'plc-1', attack_type: 'stop' });

      expect(res.status).toBe(200);
    });
  });
});
