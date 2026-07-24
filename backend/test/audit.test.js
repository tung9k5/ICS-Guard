import { jest } from '@jest/globals';
import { getAuditLogs, unblockIp } from '../src/controllers/auditController.js';
import { AuditLog, BlockedIp, User } from '../src/models/index.js';

describe('Audit Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      body: {},
      user: { _id: 'admin123' },
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

  test('getAuditLogs should retrieve logs successfully', async () => {
    const mockLogs = [
      { _id: 'log1', action: 'USER_LOGIN', username: 'admin', ipAddress: '127.0.0.1' }
    ];
    jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(AuditLog, 'find').mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(mockLogs)
    });

    await getAuditLogs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toBeDefined();
  });

  test('unblockIp should return 400 if ipAddress is missing', async () => {
    req.body = {};
    await unblockIp(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
