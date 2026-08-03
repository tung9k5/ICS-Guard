import { describe, expect, it } from 'vitest';
import { hasFreshAiAdvice, parseDiagnosisReport, selectLatestAiAdvice } from './responseWorkspaceUtils';

describe('incident response workspace utilities', () => {
  it('selects only the newest successful AI report marked by backend metadata', () => {
    const timeline = [
      { action_type: 'ai_analysis', description: 'Kết quả cũ', event_time: '2026-08-04T01:00:00Z', metadata: { ai: true } },
      { action_type: 'ai_analysis', description: 'Yêu cầu AI đã được gửi', event_time: '2026-08-04T03:00:00Z', metadata: {} },
      { action_type: 'ai_analysis', description: 'Lỗi phân tích', event_time: '2026-08-04T04:00:00Z', metadata: { error: 'offline' } },
      { action_type: 'ai_analysis', description: 'Kết quả mới', event_time: '2026-08-04T02:00:00Z', metadata: { ai: true } },
    ];

    expect(selectLatestAiAdvice(timeline)?.description).toBe('Kết quả mới');
  });

  it('splits a numbered diagnosis into scannable sections and keeps raw text as fallback', () => {
    const parsed = parseDiagnosisReport('CHẨN ĐOÁN AI\n\n1. Tóm tắt\nĐúng thiết bị PLC-01.\n\n2. Bằng chứng\n- [EV-1] FC06.');

    expect(parsed.title).toBe('CHẨN ĐOÁN AI');
    expect(parsed.sections).toEqual(expect.arrayContaining([
      expect.objectContaining({ number: 1, title: 'Tóm tắt', content: 'Đúng thiết bị PLC-01.' }),
      expect.objectContaining({ number: 2, title: 'Bằng chứng', content: '- [EV-1] FC06.' }),
    ]));
    expect(parseDiagnosisReport('Chẩn đoán cũ không có cấu trúc')).toBeNull();
  });

  it('detects a new AI result by timeline ID without relying on client/server clocks', () => {
    expect(hasFreshAiAdvice({ aiAdvice: 'Mới', aiAdviceId: 'result-2' }, 'result-1', Date.now())).toBe(true);
    expect(hasFreshAiAdvice({ aiAdvice: 'Cũ', aiAdviceId: 'result-1' }, 'result-1', Date.now())).toBe(false);
    expect(hasFreshAiAdvice({ aiAdvice: 'Mock', aiAdviceAt: '2026-08-04T02:00:00Z' }, null, new Date('2026-08-04T01:00:00Z').getTime())).toBe(true);
  });
});
