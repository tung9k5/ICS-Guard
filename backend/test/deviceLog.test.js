import { jest } from '@jest/globals';
import { getDeviceLogs, getDeviceAverages } from '../src/controllers/deviceLogController.js';
import { Device, Alert } from '../src/models/index.js';
import influxService from '../src/services/influxService.js';

describe('Device Log Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      query: {},
      body: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getDeviceLogs should retrieve physical logs from InfluxDB', async () => {
    const mockEvents = [
      { time: '2026-07-17T06:00:00Z', log_type: 'operational', event: 'MODBUS_WRITE', severity: 'INFO', message: 'Wrote to holding register' }
    ];
    jest.spyOn(influxService, 'queryDeviceEvents').mockResolvedValue(mockEvents);

    req.query = { device_id: 'plc-water-01', limit: '5' };
    await getDeviceLogs(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockEvents);
  });

  test('getDeviceAverages should return system averages when device_id is omitted', async () => {
    const mockDevices = [
      { _id: 'dev1', status: 'active', risk_score: 10 },
      { _id: 'dev2', status: 'isolated', risk_score: 50 },
      { _id: 'dev3', status: 'offline', risk_score: 0 }
    ];
    const mockInfluxAverages = { avg_cpu: 25, avg_temp: 35, avg_bandwidth: 1200 };

    jest.spyOn(Device, 'find').mockResolvedValue(mockDevices);
    jest.spyOn(Alert, 'countDocuments').mockResolvedValue(2);
    jest.spyOn(influxService, 'queryDeviceAverages').mockResolvedValue(mockInfluxAverages);

    await getDeviceAverages(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.risk_score).toBe(20); // (10 + 50 + 0) / 3 = 20
    expect(responseData.active_alerts).toBe(2);
    expect(responseData.avg_cpu).toBe(25);
    expect(responseData.status_stats).toEqual({
      active: 1,
      isolated: 1,
      alert: 0,
      offline: 1
    });
  });

  test('getDeviceAverages should return specific device stats when device_id is provided', async () => {
    const mockDevice = { _id: 'dev1', name: 'PLC 1', status: 'isolated', risk_score: 40 };
    const mockInfluxAverages = { avg_cpu: 45, avg_temp: 42, avg_bandwidth: 1800 };

    jest.spyOn(Device, 'findById').mockResolvedValue(mockDevice);
    jest.spyOn(Alert, 'countDocuments').mockResolvedValue(1);
    jest.spyOn(influxService, 'queryDeviceAverages').mockResolvedValue(mockInfluxAverages);

    req.query = { device_id: 'dev1' };
    await getDeviceAverages(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.name).toBe('PLC 1');
    expect(responseData.status).toBe('isolated');
    expect(responseData.risk_score).toBe(40);
    expect(responseData.active_alerts).toBe(1);
    expect(responseData.avg_cpu).toBe(45);
  });
});
