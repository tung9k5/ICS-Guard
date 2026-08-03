import { jest } from '@jest/globals';

// 1. Mock database and redis before dynamic imports
jest.unstable_mockModule('../src/config/redis.js', () => {
  return {
    default: {
      setEx: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      sendCommand: jest.fn().mockResolvedValue('1'),
      del: jest.fn().mockResolvedValue(1)
    }
  };
});

const { Rule } = await import('../src/models/index.js');
const { default: redisClient } = await import('../src/config/redis.js');
const { default: ruleEngineService } = await import('../src/services/ruleEngineService.js');

describe('Rule Engine Service Tests', () => {
  beforeEach(() => {
    // Reset caching properties inside the singleton ruleEngineService
    ruleEngineService.rules = [];
    ruleEngineService.lastLoadTime = 0;
    ruleEngineService.isLoading = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('evaluateCondition', () => {
    test('Operator > hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(10, '>', 5)).toBe(true);
      expect(ruleEngineService.evaluateCondition(5, '>', 10)).toBe(false);
    });

    test('Operator < hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(5, '<', 10)).toBe(true);
      expect(ruleEngineService.evaluateCondition(10, '<', 5)).toBe(false);
    });

    test('Operator >= hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(10, '>=', 10)).toBe(true);
      expect(ruleEngineService.evaluateCondition(10, '>=', 5)).toBe(true);
      expect(ruleEngineService.evaluateCondition(5, '>=', 10)).toBe(false);
    });

    test('Operator <= hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(5, '<=', 5)).toBe(true);
      expect(ruleEngineService.evaluateCondition(5, '<=', 10)).toBe(true);
      expect(ruleEngineService.evaluateCondition(10, '<=', 5)).toBe(false);
    });

    test('Operator == hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(5, '==', 5)).toBe(true);
      expect(ruleEngineService.evaluateCondition(5, '==', 10)).toBe(false);
    });

    test('Operator != hoạt động đúng', () => {
      expect(ruleEngineService.evaluateCondition(5, '!=', 10)).toBe(true);
      expect(ruleEngineService.evaluateCondition(5, '!=', 5)).toBe(false);
    });

    test('Trả về false nếu giá trị metric bị thiếu hoặc không hợp lệ', () => {
      expect(ruleEngineService.evaluateCondition(null, '>', 5)).toBe(false);
      expect(ruleEngineService.evaluateCondition(undefined, '<', 10)).toBe(false);
      expect(ruleEngineService.evaluateCondition(10, 'UNKNOWN', 5)).toBe(false);
    });
  });

  describe('Rule Evaluation', () => {
    test('Rule active được evaluate', async () => {
      const mockRules = [
        {
          rule_name: 'HIGH_CPU',
          is_active: true,
          conditions: [{ field: 'cpu_usage', operator: '>', value: 90 }],
          trigger_count: 1,
          time_window_seconds: 60
        }
      ];

      jest.spyOn(Rule, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRules)
      });

      // ZCARD mocks returning '1' (hits count matches trigger_count 1)
      jest.spyOn(redisClient, 'sendCommand').mockResolvedValue('1');

      const matched = await ruleEngineService.evaluateTelemetry({
        device_id: 'plc-1',
        zone: 'ICS-Zone',
        metrics: { cpu_usage: 95 }
      });

      expect(matched.length).toBe(1);
      expect(matched[0].rule_name).toBe('HIGH_CPU');
    });

    test('Rule inactive bị bỏ qua do loadRules chỉ tìm active', async () => {
      // Mock DB to return only active rules (so empty array if no active rules exist)
      jest.spyOn(Rule, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue([])
      });

      const matched = await ruleEngineService.evaluateTelemetry({
        device_id: 'plc-1',
        zone: 'ICS-Zone',
        metrics: { cpu_usage: 95 }
      });

      expect(matched.length).toBe(0);
      expect(Rule.find).toHaveBeenCalledWith({ is_active: true });
    });

    test('trigger_count và time_window_seconds hoạt động đúng', async () => {
      const mockRules = [
        {
          rule_name: 'HIGH_TEMP_SPAM',
          is_active: true,
          conditions: [{ field: 'temperature', operator: '>', value: 80 }],
          trigger_count: 3,
          time_window_seconds: 120
        }
      ];

      jest.spyOn(Rule, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRules)
      });

      // Simulating trigger count check:
      // First hit: count is 1 (doesn't trigger)
      // Second hit: count is 2 (doesn't trigger)
      // Third hit: count is 3 (triggers!)
      let hitCount = 0;
      jest.spyOn(redisClient, 'sendCommand').mockImplementation((args) => {
        if (args[0] === 'ZCARD') {
          hitCount++;
          return Promise.resolve(String(hitCount));
        }
        return Promise.resolve('1');
      });

      const payload = {
        device_id: 'plc-1',
        zone: 'ICS-Zone',
        metrics: { temperature: 85 }
      };

      // Hit 1
      const match1 = await ruleEngineService.evaluateTelemetry(payload);
      expect(match1.length).toBe(0);

      // Hit 2
      const match2 = await ruleEngineService.evaluateTelemetry(payload);
      expect(match2.length).toBe(0);

      // Hit 3
      const match3 = await ruleEngineService.evaluateTelemetry(payload);
      expect(match3.length).toBe(1);
      expect(match3[0].rule_name).toBe('HIGH_TEMP_SPAM');
    });

    test('Redis lỗi thì fallback sang instant match không crash', async () => {
      const mockRules = [
        {
          rule_name: 'HIGH_CPU',
          is_active: true,
          conditions: [{ field: 'cpu_usage', operator: '>', value: 90 }],
          trigger_count: 5,
          time_window_seconds: 60
        }
      ];

      jest.spyOn(Rule, 'find').mockReturnValue({
        lean: jest.fn().mockResolvedValue(mockRules)
      });

      // Mock redis to fail
      jest.spyOn(redisClient, 'sendCommand').mockRejectedValue(new Error('Redis Connection Failure'));

      const matched = await ruleEngineService.evaluateTelemetry({
        device_id: 'plc-1',
        zone: 'ICS-Zone',
        metrics: { cpu_usage: 95 }
      });

      // Verify fallback triggered instant match and didn't crash
      expect(matched.length).toBe(1);
      expect(matched[0].rule_name).toBe('HIGH_CPU');
    });
  });
});
