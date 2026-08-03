import { calculateCanonicalPolicyHash, evaluateOtFlowPolicy } from '../src/services/otPolicyService.js';

describe('OT Security Policy Engine Unit Tests', () => {
  const samplePolicy = {
    policy_id: 'test-policy-01',
    version: 2,
    default_action: 'deny',
    asset_zone_map: {
      'plc-01': 'purdue-l1',
      'sensor-01': 'purdue-l1'
    },
    rules: [
      {
        priority: 10,
        source_zone: 'purdue-l2',
        destination_zone: 'purdue-l1',
        protocol: 'modbus-tcp',
        port: 502,
        action: 'allow'
      },
      {
        priority: 10,
        source_zone: 'purdue-l2',
        destination_zone: 'purdue-l1',
        protocol: 'modbus-tcp',
        port: 502,
        action: 'deny' // Conflict at same priority level
      },
      {
        priority: 5,
        source_zone: 'purdue-l3',
        destination_zone: 'purdue-l1',
        protocol: 's7comm',
        port: 102,
        action: 'allow'
      }
    ]
  };

  test('1. Canonical Policy Hash calculation should produce consistent 64-char SHA256 string', () => {
    const hash1 = calculateCanonicalPolicyHash(samplePolicy);
    const hash2 = calculateCanonicalPolicyHash(samplePolicy);

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  test('2. Management Channel should always bypass policy and return allow', () => {
    const res = evaluateOtFlowPolicy({
      source_zone: 'unknown-zone',
      destination_device_id: 'plc-01',
      protocol: 'custom',
      port: 9999,
      channel_class: 'management',
      trusted_source: 'runtime'
    }, samplePolicy);

    expect(res.action).toBe('allow');
    expect(res.reason).toContain('Trusted runtime management channel');
  });

  test('3. Deny-Wins Logic: Equal priority allow and deny rules should resolve to DENY', () => {
    const res = evaluateOtFlowPolicy({
      source_zone: 'purdue-l2',
      destination_device_id: 'plc-01',
      protocol: 'modbus-tcp',
      port: 502,
      channel_class: 'operational'
    }, samplePolicy);

    expect(res.action).toBe('deny');
    expect(res.reason).toContain('Deny-Wins rule matched');
  });

  test('4. Unmatched flow should trigger default_action (deny)', () => {
    const res = evaluateOtFlowPolicy({
      source_zone: 'external-internet',
      destination_device_id: 'plc-01',
      protocol: 'http',
      port: 80,
      channel_class: 'operational'
    }, samplePolicy);

    expect(res.action).toBe('deny');
    expect(res.reason).toContain('Default policy action');
  });

  test('5. Unknown destination asset should fail closed', () => {
    const res = evaluateOtFlowPolicy({
      source_zone: 'purdue-l2',
      destination_device_id: 'unknown-plc',
      protocol: 'modbus-tcp',
      port: 502,
      channel_class: 'operational',
    }, samplePolicy);

    expect(res.action).toBe('deny');
    expect(res.reason).toContain('Unknown destination asset');
  });
});
