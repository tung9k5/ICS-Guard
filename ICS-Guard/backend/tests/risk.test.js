import { jest } from '@jest/globals';
import { calculateAndUpdateRiskScore } from '../src/services/riskService.js';
import { Device, Alert } from '../src/models/index.js';
import cveService from '../src/services/cveService.js';
import socketService from '../src/services/socketService.js';

describe('Risk Service Tests', () => {
  let mockDevice;
  let mockCves;
  let mockAlerts;
  let mockIo;

  beforeEach(() => {
    mockDevice = {
      _id: 'device123',
      name: 'PLC-Water-01',
      status: 'active',
      risk_score: 0,
      save: jest.fn().mockResolvedValue(true)
    };

    mockCves = [
      { cve_id: 'CVE-2023-3814', description: 'Modbus vulnerability', severity: 'HIGH', cvss: 7.5 }
    ];

    mockAlerts = [
      { _id: 'alert123', rule_name: 'Anomaly', severity: 'HIGH', status: 'new' }
    ];

    mockIo = {
      emit: jest.fn()
    };

    jest.spyOn(Device, 'findById').mockResolvedValue(mockDevice);
    jest.spyOn(cveService, 'fetchDeviceCves').mockResolvedValue(mockCves);
    jest.spyOn(Alert, 'find').mockResolvedValue(mockAlerts);
    jest.spyOn(socketService, 'getIo').mockReturnValue(mockIo);

    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should update risk score using AI Engine when fetch succeeds', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ risk_score: 45 })
    });

    const score = await calculateAndUpdateRiskScore('device123');

    expect(score).toBe(45);
    expect(mockDevice.risk_score).toBe(45);
    expect(mockDevice.save).toHaveBeenCalled();
    expect(mockIo.emit).toHaveBeenCalledWith('DEVICE_RISK_UPDATED', expect.objectContaining({ risk_score: 45 }));
  });

  test('should update risk score using Local Fallback when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Connection refused'));

    const score = await calculateAndUpdateRiskScore('device123');

    // Expected local fallback score:
    // baseScore (status active -> online -> 10)
    // CVE impact (cvss 7.5 * 3.5 = 26.25)
    // Alert impact (HIGH alert -> 20)
    // Total = 10 + 26.25 + 20 = 56.25 -> Round to 56
    expect(score).toBe(56);
    expect(mockDevice.risk_score).toBe(56);
    expect(mockDevice.save).toHaveBeenCalled();
    expect(mockIo.emit).toHaveBeenCalledWith('DEVICE_RISK_UPDATED', expect.objectContaining({ risk_score: 56 }));
  });
});
