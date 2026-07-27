import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// 1. Mock dependent services
jest.unstable_mockModule('../src/config/redis.js', () => ({
  default: {
    setEx: jest.fn(),
    get: jest.fn(),
    sendCommand: jest.fn(),
    del: jest.fn()
  }
}));

jest.unstable_mockModule('../src/services/mqttService.js', () => ({
  publishMqtt: jest.fn().mockReturnValue(true),
  connectMqtt: jest.fn()
}));

jest.unstable_mockModule('../src/services/riskService.js', () => ({
  calculateAndUpdateRiskScore: jest.fn().mockResolvedValue(true)
}));

jest.unstable_mockModule('../src/services/influxService.js', () => ({
  writeTelemetry: jest.fn().mockResolvedValue(true),
  writeDeviceEvent: jest.fn().mockResolvedValue(true)
}));

jest.unstable_mockModule('../src/services/socketService.js', () => {
  const mockAlertEmit = jest.fn();
  const mockIncidentEmit = jest.fn();
  return {
    emitNewAlert: mockAlertEmit,
    emitNewIncident: mockIncidentEmit,
    getIo: jest.fn().mockReturnValue({ emit: jest.fn() }),
    default: {
      emitNewAlert: mockAlertEmit,
      emitNewIncident: mockIncidentEmit,
      getIo: jest.fn().mockReturnValue({ emit: jest.fn() })
    }
  };
});

jest.unstable_mockModule('../src/services/ruleEngineService.js', () => {
  return {
    default: {
      evaluateTelemetry: jest.fn()
    }
  };
});

// 2. Dynamic imports
const { Alert, Incident, IncidentTimeline } = await import('../src/models/index.js');
const { default: socketService } = await import('../src/services/socketService.js');
const { default: ruleEngineService } = await import('../src/services/ruleEngineService.js');
const { default: telemetryRoutes } = await import('../src/routes/telemetryRoutes.js');

describe('Incident Flow Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/telemetry', telemetryRoutes);
    process.env.DEVICE_API_KEY = 'test_device_key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  test('Telemetry vượt rule tạo alert, incident, timeline và gọi socket emit', async () => {
    // Mock the matched rule returned by the Rule Engine
    const mockRule = {
      rule_name: 'HIGH_TEMP',
      alert_title: 'Nhiệt độ cực cao',
      alert_description: 'Nhiệt độ PLC vượt quá 90 độ C',
      severity: 'CRITICAL'
    };
    jest.spyOn(ruleEngineService, 'evaluateTelemetry').mockResolvedValue([mockRule]);

    // Mock database creations and findOne
    const mockAlert = {
      _id: 'alert123',
      rule_name: 'HIGH_TEMP',
      device_id: 'plc-1',
      title: 'Nhiệt độ cực cao',
      description: 'Nhiệt độ PLC vượt quá 90 độ C',
      severity: 'CRITICAL',
      status: 'new',
      save: jest.fn().mockResolvedValue(true)
    };

    const mockIncident = {
      _id: 'incident123',
      title: 'Nhiệt độ cực cao',
      description: 'Nhiệt độ PLC vượt quá 90 độ C',
      severity: 'CRITICAL',
      status: 'open',
      alert_ids: ['alert123'],
      save: jest.fn().mockResolvedValue(true)
    };

    const mockTimeline = {
      _id: 'timeline123',
      incident_id: 'incident123',
      actor: 'System',
      action_type: 'rule_trigger',
      description: 'Sự cố được kích hoạt tự động từ thiết bị plc-1 do khớp quy tắc giám sát.'
    };

    jest.spyOn(Alert, 'create').mockResolvedValue(mockAlert);
    jest.spyOn(Incident, 'findOne').mockResolvedValue(null); // No existing active incident
    jest.spyOn(Incident, 'create').mockResolvedValue(mockIncident);
    jest.spyOn(IncidentTimeline, 'create').mockResolvedValue(mockTimeline);

    // Send a Syslog containing telemetry metric temp=95 to trigger processTelemetryLogEntry
    const rawSyslog = '<34> Oct 11 22:14:15 plc-1 temp=95';
    const res = await request(app)
      .post('/api/telemetry/syslog')
      .set('x-device-api-key', 'test_device_key')
      .send({ log: rawSyslog });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    // 1. Verify Alert was created
    expect(Alert.create).toHaveBeenCalledWith(expect.objectContaining({
      rule_name: 'HIGH_TEMP',
      device_id: 'plc-1',
      severity: 'CRITICAL'
    }));

    // 2. Verify Incident was created because no existing incident matched
    expect(Incident.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Nhiệt độ cực cao',
      severity: 'CRITICAL',
      status: 'open',
      alert_ids: expect.arrayContaining([mockAlert._id])
    }));

    // 3. Verify Alert had incident_id attached and saved
    expect(mockAlert.incident_id).toBe(mockIncident._id);
    expect(mockAlert.save).toHaveBeenCalled();

    // 4. Verify Timeline record was created
    expect(IncidentTimeline.create).toHaveBeenCalledWith(expect.objectContaining({
      incident_id: mockIncident._id,
      actor: 'System',
      action_type: 'rule_trigger'
    }));

    // 5. Verify Socket emits were called for both alert and incident
    expect(socketService.emitNewAlert).toHaveBeenCalledWith(mockAlert);
    expect(socketService.emitNewIncident).toHaveBeenCalledWith(mockIncident);
  });
});
