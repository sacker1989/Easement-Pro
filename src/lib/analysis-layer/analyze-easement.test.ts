import { describe, expect, it } from 'vitest';
import { analyzeEasement, UnsupportedStateRuleSetError } from './analyze-easement';

const clearAppurtenantFacts = {
  easementType: 'appurtenant' as const,
  hasPerpetualLanguage: true,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('analyzeEasement', () => {
  it('runs the CA duration rule set for a CA input', () => {
    const result = analyzeEasement({ state: 'CA', duration: clearAppurtenantFacts });
    expect(result.state).toBe('CA');
    expect(result.duration.tier).toBe('clear');
  });

  it('normalizes a lowercase state code', () => {
    const result = analyzeEasement({ state: 'ca', duration: clearAppurtenantFacts });
    expect(result.state).toBe('CA');
  });

  it('throws for a state with no implemented rule set', () => {
    expect(() => analyzeEasement({ state: 'TX', duration: clearAppurtenantFacts })).toThrow(
      UnsupportedStateRuleSetError,
    );
  });
});
