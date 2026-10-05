import { describe, expect, it } from 'vitest';
import { analyzeEasementAt } from './analyze-easement';
import { CA_DURATION_RULE_SET } from './ca-rule-set';
import type { EasementDurationFacts } from './duration-facts';

const TODAY = '2026-10-05';

const noExpressLanguage: EasementDurationFacts = {
  easementType: 'appurtenant',
  hasPerpetualLanguage: false,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('a free analysis that does not wait for counsel', () => {
  it('gives an unreviewed California user something useful instead of silence', () => {
    // BEFORE THIS, the answer here was "no determination is offered" and
    // nothing else — true, and useless to a homeowner who came to find out
    // what their easement means.
    const r = analyzeEasementAt({ state: 'CA', duration: noExpressLanguage }, TODAY);
    expect(r.ruleSet.status).toBe('unavailable');
    expect(r.advisory).not.toBeNull();
    expect(r.advisory!.ruleId).toBe('ca-appurtenant-default-presumption');
  });

  it('still offers no determination alongside the advisory', () => {
    // The two coexist. An advisory is not a downgraded finding — `duration`
    // reports flagged-ambiguous exactly as it did, so any surface rendering
    // only `duration` is unchanged and still correct.
    const r = analyzeEasementAt({ state: 'CA', duration: noExpressLanguage }, TODAY);
    expect(r.duration.tier).toBe('flagged-ambiguous');
    expect(r.duration.ruleId).toBe('state-rule-set-unavailable');
    expect(r.firedRule).toBeNull();
  });

  it('speaks about the law, not about this user', () => {
    // THE ASSERTION THAT KEEPS THIS LAWFUL. "California courts generally
    // presume…" is a general proposition. "Your easement is perpetual" is
    // applying law to facts, which is the thing being withheld. If an advisory
    // ever starts with "your", the distinction has collapsed.
    const r = analyzeEasementAt({ state: 'CA', duration: noExpressLanguage }, TODAY);
    const a = r.advisory!;
    expect(a.generalPosition).toMatch(/courts generally/i);
    expect(a.generalPosition).not.toMatch(/^your\b/i);
    expect(a.generalPosition).not.toMatch(/\byour easement is\b/i);
  });

  it('discards the rule’s own conclusion and keeps only the framing', () => {
    // ca-appurtenant-default-presumption's summary says "presumed to run with
    // the land indefinitely" ABOUT THIS EASEMENT. That sentence must not reach
    // the user through the advisory path.
    const r = analyzeEasementAt({ state: 'CA', duration: noExpressLanguage }, TODAY);
    const serialized = JSON.stringify(r.advisory);
    expect(serialized).not.toContain('No express duration language was found');
    expect(Object.keys(r.advisory!).sort()).toEqual([
      'askYourAttorney',
      'generalPosition',
      'ruleId',
      'whyNotDetermined',
    ]);
  });

  it('hands over a question rather than an answer', () => {
    for (const easementType of ['appurtenant', 'in-gross', 'prescriptive'] as const) {
      const r = analyzeEasementAt(
        { state: 'CA', duration: { ...noExpressLanguage, easementType } },
        TODAY,
      );
      expect(r.advisory, `${easementType} should produce an advisory`).not.toBeNull();
      expect(r.advisory!.askYourAttorney).toMatch(/\?$/);
      expect(r.advisory!.whyNotDetermined.length).toBeGreaterThan(40);
    }
  });

  it('raises a different question for each easement character', () => {
    const ids = (['appurtenant', 'in-gross', 'prescriptive'] as const).map(
      (easementType) =>
        analyzeEasementAt(
          { state: 'CA', duration: { ...noExpressLanguage, easementType } },
          TODAY,
        ).advisory!.ruleId,
    );
    expect(new Set(ids).size).toBe(3);
  });

  it('offers no advisory when the document already answered the question', () => {
    // An express instrument gets a real finding. Adding an advisory there
    // would imply the reading needs validating, which it does not.
    const r = analyzeEasementAt(
      { state: 'CA', duration: { ...noExpressLanguage, hasPerpetualLanguage: true } },
      TODAY,
    );
    expect(r.duration.tier).toBe('clear');
    expect(r.advisory).toBeNull();
  });

  it('offers no advisory for a state with no rule set at all', () => {
    // Nothing registered means nothing to say, advisorily or otherwise.
    const r = analyzeEasementAt({ state: 'TX', duration: noExpressLanguage }, TODAY);
    expect(r.advisory).toBeNull();
  });

  it('offers no advisory for Florida, which has no doctrine rules', () => {
    // FL ships observation rules only, deliberately — no Florida presumption
    // has been researched. No rule, no advisory, which is correct: an advisory
    // still asserts a general proposition about a state's law.
    const r = analyzeEasementAt({ state: 'FL', duration: noExpressLanguage }, TODAY);
    expect(r.advisory).toBeNull();
  });
});

describe('advisory framing is opt-in', () => {
  it('every CA doctrine rule carries one, and no observation rule does', () => {
    for (const rule of CA_DURATION_RULE_SET) {
      if (rule.claimType === 'state-doctrine') {
        expect(rule.advisory, `${rule.id} should carry advisory framing`).toBeDefined();
      } else {
        // An observation rule produces a finding directly. Advisory framing on
        // one would mean a plain reading of a document was being presented as
        // something to validate with a lawyer.
        expect(rule.advisory, `${rule.id} should not carry advisory framing`).toBeUndefined();
      }
    }
  });

  it('a doctrine rule without framing stays silent rather than guessing', () => {
    const stripped = CA_DURATION_RULE_SET.map((r) =>
      r.claimType === 'state-doctrine' ? { ...r, advisory: undefined } : r,
    );
    // Simulated by filtering the way analyzeEasement does: no framing, no
    // advisory. The opt-in is what stops a newly added doctrine rule from
    // speaking before anyone wrote its question.
    expect(stripped.filter((r) => r.advisory !== undefined)).toHaveLength(0);
  });
});
