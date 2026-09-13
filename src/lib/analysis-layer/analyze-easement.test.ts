import { describe, expect, it } from 'vitest';
import { analyzeEasement, UnsupportedStateRuleSetError , UNAVAILABLE_RULE_ID } from './analyze-easement';

const clearAppurtenantFacts = {
  easementType: 'appurtenant' as const,
  hasPerpetualLanguage: true,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('analyzeEasement', () => {
  it('runs CA OBSERVATION rules even though CA is unreviewed', () => {
    // The unlock. The gate blocks claims about the LAW; reading the document
    // is a different thing and needs no review. This instrument expressly says
    // perpetual, so the document has already answered the question and the
    // product says so.
    const result = analyzeEasement({ state: 'CA', duration: clearAppurtenantFacts });
    expect(result.state).toBe('CA');
    expect(result.duration.tier).toBe('clear');
    expect(result.duration.ruleId).toBe('ca-express-perpetual');
    // The rule set itself is still ungated — nothing about this made CA reviewed.
    expect(result.ruleSet.status).toBe('unavailable');
    if (result.ruleSet.status === 'unavailable') {
      expect(result.ruleSet.reason).toBe('never-reviewed');
    }
  });

  it('still blocks the CA answers that depend on doctrine', () => {
    // No express language, so the answer turns on California's presumption
    // that an appurtenant easement runs with the land. That is the claim the
    // gate exists to stop, and it stays stopped.
    const result = analyzeEasement({
      state: 'CA',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: false,
        hasTermOrConditionSubsequent: false,
        documentLegible: true,
      },
    });
    expect(result.duration.tier).toBe('flagged-ambiguous');
    expect(result.duration.ruleId).toBe(UNAVAILABLE_RULE_ID);
  });

  it('runs the observation rules that FLAG, too', () => {
    // An illegible document is an observation, not doctrine, and saying so is
    // more useful than a generic unavailable notice.
    const result = analyzeEasement({
      state: 'CA',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: true,
        hasTermOrConditionSubsequent: false,
        documentLegible: false,
      },
    });
    expect(result.duration.ruleId).toBe('ca-illegible-document');
  });

  it('gives a state with NO entry nothing to run', () => {
    // Texas has no rule set at all, so there are no observation rules either.
    const result = analyzeEasement({ state: 'TX', duration: clearAppurtenantFacts });
    expect(result.duration.ruleId).toBe(UNAVAILABLE_RULE_ID);
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
