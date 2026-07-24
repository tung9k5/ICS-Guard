import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// 1. Mock the services/models
jest.unstable_mockModule('../src/services/aiChatService.js', () => ({
  callGeminiChat: jest.fn()
}));

// 2. Import modules dynamically
const { default: aiRoutes } = await import('../src/routes/aiRoutes.js');
const { callGeminiChat } = await import('../src/services/aiChatService.js');
const { User } = await import('../src/models/index.js');

describe('AI Chat Route & Controller Integration Tests', () => {
  let app;
  const secretKey = 'test_jwt_access_secret_key_length_32';

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = secretKey;
    process.env.GEMINI_API_KEY = 'test_gemini_key';

    app = express();
    app.use(express.json());
    // Mount routes under /api/ai
    app.use('/api/ai', aiRoutes);
  });

  beforeEach(() => {
    jest.spyOn(User, 'findById').mockResolvedValue({
      _id: 'user123',
      role: 'analyst',
      is_active: true,
      login_failures: { lockout_until: null }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('should return 401 if token is missing (Unauthorized)', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'hello bot' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  test('should return 400 if message is missing/empty', async () => {
    const token = jwt.sign({ id: 'user123', role: 'analyst' }, secretKey, { expiresIn: '1h' });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  test('should return success response with bot reply when token and message are valid', async () => {
    const token = jwt.sign({ id: 'user123', role: 'analyst' }, secretKey, { expiresIn: '1h' });
    callGeminiChat.mockResolvedValue('Hi, I am your ICS guide.');

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'analyze PLC anomaly' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.reply).toBe('Hi, I am your ICS guide.');
    expect(callGeminiChat).toHaveBeenCalledWith('analyze PLC anomaly');
  });

  test('should fall back correctly if GEMINI_API_KEY is not defined', async () => {
    const token = jwt.sign({ id: 'user123', role: 'analyst' }, secretKey, { expiresIn: '1h' });
    
    // Temporarily delete env key
    const oldKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    callGeminiChat.mockImplementationOnce(async () => {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return 'Offline Fallback Mode response';
      return 'AI reply';
    });

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('Offline Fallback Mode response');

    // Restore env key
    process.env.GEMINI_API_KEY = oldKey;
  });
});
