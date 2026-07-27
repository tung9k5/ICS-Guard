import { jest } from '@jest/globals';

// 1. Mock dependency
jest.unstable_mockModule('../src/services/mqttService.js', () => ({
  publishMqtt: jest.fn().mockReturnValue(true)
}));

// 2. Import dynamically
const { launchAttack, getAttackDevices } = await import('../src/controllers/attackController.js');
const { Device } = await import('../src/models/index.js');

describe('Attack Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
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

  test('launchAttack should return 400 if device_id is missing', async () => {
    req.body = { attack_type: 'recon' };
    await launchAttack(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('launchAttack should succeed with correct parameters', async () => {
    req.body = { device_id: 'plc-1', attack_type: 'dos' };
    await launchAttack(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
  });

  test('getAttackDevices should return devices list', async () => {
    const mockDevices = [{ _id: 'd1', name: 'PLC-1', type: 'plc' }];
    jest.spyOn(Device, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(Device, 'find').mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(mockDevices)
    });

    await getAttackDevices(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.status).toBe('success');
    expect(responseArgs.data).toEqual(mockDevices);
  });
});
