import { jest } from '@jest/globals';

// 1. Mock dependency
jest.unstable_mockModule('../src/services/influxService.js', () => ({
  queryNetworkTrafficDashboard: jest.fn().mockResolvedValue([{ time: new Date(), bytes_in: 100, bytes_out: 200 }])
}));

// 2. Import dynamically
const { getSystemHealth, getRiskStatus, getNetworkTraffic } = await import('../src/controllers/dashboardController.js');
const { Device } = await import('../src/models/index.js');

describe('Dashboard Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getSystemHealth should return aggregated device health statuses', async () => {
    const mockDevices = [
      { status: 'active' },
      { status: 'online' },
      { status: 'offline' }
    ];
    jest.spyOn(Device, 'find').mockResolvedValue(mockDevices);

    await getSystemHealth(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs).toEqual([
      { key: 'healthy', value: 2 },
      { key: 'warning', value: 1 },
      { key: 'critical', value: 0 }
    ]);
  });

  test('getRiskStatus should compute risk averages', async () => {
    const mockDevices = [
      { risk_score: 50 },
      { risk_score: 80 }
    ];
    jest.spyOn(Device, 'find').mockResolvedValue(mockDevices);

    await getRiskStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseArgs = res.json.mock.calls[0][0];
    expect(responseArgs.averageRisk).toBe(65);
    expect(responseArgs.topDevices.length).toBe(2);
  });

  test('getNetworkTraffic should fetch network stats successfully', async () => {
    await getNetworkTraffic(req, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
