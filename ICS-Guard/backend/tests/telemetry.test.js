import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// 1. Register the mock BEFORE importing other modules
jest.unstable_mockModule('../src/services/mqttService.js', () => ({
  publishMqtt: jest.fn().mockReturnValue(true),
  connectMqtt: jest.fn()
}));

jest.unstable_mockModule('../src/services/influxService.js', () => ({
  writeTelemetry: jest.fn().mockResolvedValue(true),
  writeDeviceEvent: jest.fn().mockResolvedValue(true)
}));

jest.unstable_mockModule('../src/services/ruleEngineService.js', () => ({
  default: {
    evaluateTelemetry: jest.fn().mockResolvedValue([])
  }
}));

jest.unstable_mockModule('../src/services/riskService.js', () => ({
  calculateAndUpdateRiskScore: jest.fn().mockResolvedValue(true)
}));

// 2. Import dynamically to respect ESM execution order
const { getBlockedIpsPublic, ingestTelemetryLog, controlAttackEndpoint } = await import('../src/controllers/telemetryController.js');
const { BlockedIp, Device } = await import('../src/models/index.js');
const { default: telemetryRoutes } = await import('../src/routes/telemetryRoutes.js');

describe('Telemetry Controller Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      ip: '127.0.0.1'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    process.env.DEVICE_API_KEY = 'test_device_key';
    process.env.ATTACK_SIMULATOR_API_KEY = 'test_attack_key';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('getBlockedIpsPublic should return blocked IPs', async () => {
    const mockList = [{ ipAddress: '192.168.1.99', reason: 'Too many requests' }];
    jest.spyOn(BlockedIp, 'find').mockResolvedValue(mockList);

    await getBlockedIpsPublic(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockList);
  });

  test('ingestTelemetryLog should return 400 if device_id is missing', async () => {
    req.body = {};
    await ingestTelemetryLog(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('controlAttackEndpoint should handle valid control attack stop command', async () => {
    req.body = { device_id: 'plc-1', attack_type: 'stop' };
    jest.spyOn(Device, 'findByIdAndUpdate').mockResolvedValue({});

    await controlAttackEndpoint(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'success'
    }));
  });
});

describe('Telemetry Route Protection Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryRoutes);
    process.env.DEVICE_API_KEY = 'test_device_key';
  });

  test('Thiếu x-device-api-key khi gọi telemetry endpoints bị 401', async () => {
    const endpoints = [
      { path: '/api/telemetry/blocked-ips', method: 'get' },
      { path: '/api/telemetry/ingest', method: 'post' },
      { path: '/api/telemetry/syslog', method: 'post' },
      { path: '/api/telemetry/upload-logs', method: 'post' }
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)[endpoint.method](endpoint.path).send({});
      expect(res.status).toBe(401);
    }
  });

  test('Sai x-device-api-key bị 401', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'wrong_key')
      .send({});
    expect(res.status).toBe(401);
  });

  test('Đúng x-device-api-key request đi được tới controller', async () => {
    jest.spyOn(Device, 'findOne').mockResolvedValue({ device_id: 'plc-1', zone: 'zone-1' });
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({ device_id: 'plc-1' });

    expect(res.status).toBe(200);
  });
});

describe('Telemetry Validation Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryRoutes);
    process.env.DEVICE_API_KEY = 'test_device_key';
  });

  beforeEach(() => {
    jest.spyOn(Device, 'findOne').mockResolvedValue({ device_id: 'plc-1', zone: 'zone-1' });
  });

  test('Payload hợp lệ trả success 200', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({
        device_id: 'plc-1',
        log_type: 'info',
        event: 'TEMP_NORMAL',
        source_ip: '192.168.1.100',
        username: 'operator',
        timestamp: new Date().toISOString()
      });
    expect(res.status).toBe(200);
  });

  test('Thiếu device_id trả 400', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({ log_type: 'info' });
    expect(res.status).toBe(400);
  });

  test('device_id rỗng trả 400', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({ device_id: '  ', log_type: 'info' });
    expect(res.status).toBe(400);
  });

  test('Timestamp sai format trả 400', async () => {
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({ device_id: 'plc-1', timestamp: 'not-a-date' });
    expect(res.status).toBe(400);
  });

  test('Timestamp lệch quá 5 phút bị chặn replay 400', async () => {
    const oldTimestamp = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/telemetry/ingest')
      .set('x-device-api-key', 'test_device_key')
      .send({ device_id: 'plc-1', timestamp: oldTimestamp });
    expect(res.status).toBe(400);
  });

  test('log_type, event, source_ip, username sai kiểu bị chặn 400', async () => {
    const invalidPayloads = [
      { device_id: 'plc-1', log_type: 123 },
      { device_id: 'plc-1', event: {} },
      { device_id: 'plc-1', source_ip: true },
      { device_id: 'plc-1', username: [] }
    ];

    for (const payload of invalidPayloads) {
      const res = await request(app)
        .post('/api/telemetry/ingest')
        .set('x-device-api-key', 'test_device_key')
        .send(payload);
      expect(res.status).toBe(400);
    }
  });
});
