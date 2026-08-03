import { jest } from '@jest/globals';
import aiService from '../src/services/aiService.js';

describe('Focused incident diagnosis fallback', () => {
  const incident = { _id: 'inc-1', title: 'Unauthorized Modbus FC06 write', description: 'Register value changed', severity: 'CRITICAL', status: 'investigating' };
  const device = { _id: 'dev-1', name: 'PLC-01', ipAddress: '10.0.0.5', node_type: 'controller', zone: 'Zone-A', security_status: 'isolated' };
  const alerts = [{ _id: 'a1', evidence_id: 'alert:a1', rule_name: 'MODBUS_WRITE', title: 'FC06 write detected', severity: 'CRITICAL', source_ip: '10.0.0.99', destination_ip: '10.0.0.5', event_count: 4, raw_events_sample: [{ message: 'FC06 register 22 value 8500' }] }];

  it('builds an incident-specific evidence bundle', () => {
    const bundle = aiService.buildEvidenceBundle(incident, device, alerts, { timeline: [] });
    expect(bundle.incident.id).toBe('inc-1');
    expect(bundle.primary_device.ip_address).toBe('10.0.0.5');
    expect(bundle.alerts[0].source_ip).toBe('10.0.0.99');
  });

  it('produces a focused fallback with evidence, target and recovery gates', () => {
    const bundle = aiService.buildEvidenceBundle(incident, device, alerts, {});
    const report = aiService.generateEvidenceAwareFallback(bundle, 'test fallback');
    expect(report).toContain('10.0.0.99');
    expect(report).toContain('FC06 write detected');
    expect(report).toContain('BẰNG CHỨNG ĐÃ DÙNG');
    expect(report).toContain('HÀNH ĐỘNG ƯU TIÊN');
    expect(report).toContain('ĐIỀU KIỆN KHÔI PHỤC');
    expect(report).not.toContain('192.168.1.100');
  });

  it('sends the nested evidence contract and preserves an actionable AI response', async () => {
    const bundle = aiService.buildEvidenceBundle(incident, device, alerts, {});
    const actionableAnalysis = aiService.generateEvidenceAwareFallback(bundle, 'validated response');
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ analysis: actionableAnalysis }),
    });

    try {
      const result = await aiService.analyzeIncident(incident, device, alerts, {});

      expect(result).toBe(actionableAnalysis);
      const request = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(request.language).toBe('vi');
      expect(request.evidence.schema_version).toBe('incident-evidence.v1');
      expect(request.evidence.incident.id).toBe('inc-1');
      expect(request.evidence.primary_device.id).toBe('dev-1');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
