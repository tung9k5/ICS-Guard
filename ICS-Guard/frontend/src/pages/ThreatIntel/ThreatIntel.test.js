import { describe, expect, it } from 'vitest';
import { inferTactics, TACTICS } from './index';

describe('Threat Intelligence tactic mapping', () => {
  it('uses the 12 tactics defined by the project plan', () => {
    expect(TACTICS).toHaveLength(12);
  });

  it('preserves multiple explicit tactics', () => {
    expect(inferTactics({ mitre_tactics: ['Execution', 'Impact'] })).toEqual(['Execution', 'Impact']);
  });

  it('maps an incident into every matching tactic without duplicates', () => {
    const tactics = inferTactics({ title: 'Malware script scans PLC then causes shutdown', category: 'command and control', severity: 'CRITICAL' });
    expect(tactics).toEqual(expect.arrayContaining(['Execution', 'Discovery', 'Command and Control', 'Impair Process Control', 'Impact']));
    expect(new Set(tactics).size).toBe(tactics.length);
  });
});
