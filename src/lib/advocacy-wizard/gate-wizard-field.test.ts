import { describe, expect, it } from 'vitest';
import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import { gateWizardField, isFieldUsableInLetter } from './gate-wizard-field';

describe('gateWizardField', () => {
  it('marks a clear result as usable', () => {
    const result: TieredResult<string> = { tier: 'clear', ruleId: 'r1', value: 'perpetual' };
    const gate = gateWizardField('Easement duration', result);
    expect(gate.status).toBe('usable');
    if (gate.status === 'usable') {
      expect(gate.value).toBe('perpetual');
    }
  });

  it('marks a likely-with-caveat result as usable-with-caveat, carrying the caveat', () => {
    const result: TieredResult<string> = {
      tier: 'likely-with-caveat',
      ruleId: 'r2',
      value: 'perpetual (default)',
      caveat: 'this is a default presumption',
    };
    const gate = gateWizardField('Easement duration', result);
    expect(gate.status).toBe('usable-with-caveat');
    if (gate.status === 'usable-with-caveat') {
      expect(gate.caveat).toBe('this is a default presumption');
    }
  });

  it('marks a flagged-ambiguous result as blocked, with a clarification offer', () => {
    const result: TieredResult<string> = {
      tier: 'flagged-ambiguous',
      ruleId: 'r3',
      flagReason: 'conflicting clauses',
    };
    const gate = gateWizardField('Easement duration', result);
    expect(gate.status).toBe('blocked');
    if (gate.status === 'blocked') {
      expect(gate.clarificationOffer.topic).toBe('Easement duration');
      expect(gate.clarificationOffer.context).toBe('conflicting clauses');
    }
  });
});

describe('isFieldUsableInLetter', () => {
  it('is true for usable and usable-with-caveat, false for blocked', () => {
    const usable = gateWizardField('f', { tier: 'clear', ruleId: 'r', value: 1 } as TieredResult<number>);
    const caveated = gateWizardField('f', {
      tier: 'likely-with-caveat',
      ruleId: 'r',
      value: 1,
      caveat: 'c',
    } as TieredResult<number>);
    const blocked = gateWizardField('f', { tier: 'flagged-ambiguous', ruleId: 'r', flagReason: 'x' });

    expect(isFieldUsableInLetter(usable)).toBe(true);
    expect(isFieldUsableInLetter(caveated)).toBe(true);
    expect(isFieldUsableInLetter(blocked)).toBe(false);
  });
});
