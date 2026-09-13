import { describe, expect, it } from 'vitest';
import { analyzeEasement, UnsupportedStateRuleSetError , UNAVAILABLE_RULE_ID } from './analyze-easement';

const clearAppurtenantFacts = {
  easementType: 'appurtenant' as const,
  hasPerpetualLanguage: true,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('analyzeEasement', () => {
  it('DEGRADES for CA, because CA has never been counsel-reviewed', () => {
    // Behaviour change, Phase 3. This previously asserted 'clear'. California
    // is the reference implementation of the SHAPE, not a state that cleared
    // the gate: its entry has review: null, so it resolves 'unavailable' for
    // exactly the same reason Texas does. The old assertion encoded the very
    // problem this phase exists to remove — a substantive determination issued
    // on the strength of a rule set nobody had reviewed.
    const result = analyzeEasement({ state: 'CA', duration: clearAppurtenantFacts });
    expect(result.state).toBe('CA');
    expect(result.duration.tier).toBe('flagged-ambiguous');
    expect(result.ruleSet.status).toBe('unavailable');
    if (result.ruleSet.status === 'unavailable') {
      expect(result.ruleSet.reason).toBe('never-reviewed');
    }
  });

  it('normalizes a lowercase state code', () => {
    const result = analyzeEasement({ state: 'ca', duration: clearAppurtenantFacts });
    expect(result.state).toBe('CA');
  });

  it('returns flagged for a state with no rule set, rather than throwing', () => {
    // Throwing is not degrading: it forced every caller into a try/catch and
    // produced no user-facing tiered result. A flagged result renders through
    // the display that already exists.
    const result = analyzeEasement({ state: 'TX', duration: clearAppurtenantFacts });
    expect(result.duration.tier).toBe('flagged-ambiguous');
    expect(result.duration.ruleId).toBe(UNAVAILABLE_RULE_ID);
    if (result.ruleSet.status === 'unavailable') {
      expect(result.ruleSet.reason).toBe('no-rule-set');
    }
  });

  it('distinguishes absence of review from substantive ambiguity', () => {
    // A user with a genuinely contradictory document and a user in an
    // unreviewed state both see 'flagged-ambiguous'. The copy and the ruleId
    // are what separate them, so both are part of the contract.
    const result = analyzeEasement({ state: 'TX', duration: clearAppurtenantFacts });
    if (result.duration.tier !== 'flagged-ambiguous') throw new Error('expected flagged');
    expect(result.duration.flagReason).toMatch(/absence of\s+review/);
    expect(result.duration.flagReason).toMatch(/not a finding that the easement itself is ambiguous/);
  });

  it('carries no value key when unavailable', () => {
    // Asserted as absence of the KEY, not as undefined, so a widened type
    // cannot slip a value through.
    const result = analyzeEasement({ state: 'TX', duration: clearAppurtenantFacts });
    expect('value' in result.duration).toBe(false);
  });

  it('still throws for something that is not a state code at all', () => {
    // UnsupportedStateRuleSetError is retained and narrowed to programmer error.
    expect(() => analyzeEasement({ state: 'Texas', duration: clearAppurtenantFacts })).toThrow(
      UnsupportedStateRuleSetError,
    );
  });
});
