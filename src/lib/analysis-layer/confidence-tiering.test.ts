import { describe, expect, it } from 'vitest';
import { classifyByRules, type ConfidenceRule } from './confidence-tiering';

interface Facts {
  value: number;
}

const rules: ReadonlyArray<ConfidenceRule<Facts, string>> = [
  {
    id: 'negative-is-flagged',
    claimType: 'observation',
    evaluate(facts) {
      if (facts.value < 0) {
        return { tier: 'flagged-ambiguous', flagReason: 'negative value' };
      }
      return null;
    },
  },
  {
    id: 'small-is-caveated',
    claimType: 'observation',
    evaluate(facts) {
      if (facts.value < 10) {
        return { tier: 'likely-with-caveat', value: 'small', caveat: 'value is small' };
      }
      return null;
    },
  },
  {
    id: 'large-is-clear',
    claimType: 'observation',
    evaluate(facts) {
      if (facts.value >= 10) {
        return { tier: 'clear', value: 'large' };
      }
      return null;
    },
  },
];

const fallback = { tier: 'flagged-ambiguous', flagReason: 'no rule matched' } as const;

describe('classifyByRules', () => {
  it('returns the first matching rule, tagged with its ruleId', () => {
    const result = classifyByRules({ value: -5 }, rules, fallback);
    expect(result).toEqual({ tier: 'flagged-ambiguous', ruleId: 'negative-is-flagged', flagReason: 'negative value' });
  });

  it('stops at the first matching rule and does not fall through to later rules', () => {
    const result = classifyByRules({ value: 5 }, rules, fallback);
    expect(result.ruleId).toBe('small-is-caveated');
    expect(result.tier).toBe('likely-with-caveat');
  });

  it('reaches a later rule when earlier ones do not match', () => {
    const result = classifyByRules({ value: 20 }, rules, fallback);
    expect(result).toEqual({ tier: 'clear', ruleId: 'large-is-clear', value: 'large' });
  });

  it('falls back to flagged-ambiguous when no rule matches', () => {
    const result = classifyByRules({ value: 20 }, [], fallback);
    expect(result).toEqual({ tier: 'flagged-ambiguous', ruleId: 'fallback-no-rule-matched', flagReason: 'no rule matched' });
  });
});
