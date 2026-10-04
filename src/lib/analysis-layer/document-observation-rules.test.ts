import { describe, expect, it } from 'vitest';
import { CA_DURATION_RULE_SET } from './ca-rule-set';
import { classifyByRules } from './confidence-tiering';
import { documentObservationRules, InvalidRulePrefixError } from './document-observation-rules';
import type { EasementDurationFacts } from './duration-facts';

const base: EasementDurationFacts = {
  easementType: 'appurtenant',
  hasPerpetualLanguage: false,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

const FALLBACK = { tier: 'flagged-ambiguous', flagReason: 'test fallback' } as const;

function classifyWith(prefix: string, facts: EasementDurationFacts) {
  return classifyByRules(facts, documentObservationRules(prefix), FALLBACK);
}

describe('documentObservationRules', () => {
  it('stamps the state prefix onto every id', () => {
    expect(documentObservationRules('fl').map((r) => r.id)).toEqual([
      'fl-illegible-document',
      'fl-conflicting-duration-clauses',
      'fl-unknown-easement-type',
      'fl-express-term-limited',
      'fl-express-perpetual',
    ]);
  });

  it('claims observation for every rule, since none of them asserts a rule of law', () => {
    // The whole reason these can run in an unreviewed state. A rule added here
    // that applied doctrine would silently become available in every state at
    // once, which is the failure this assertion exists to catch.
    expect(documentObservationRules('fl').every((r) => r.claimType === 'observation')).toBe(true);
  });

  it('rejects a malformed prefix rather than writing it into audit records', () => {
    expect(() => documentObservationRules('CA')).toThrow(InvalidRulePrefixError);
    expect(() => documentObservationRules('cal')).toThrow(InvalidRulePrefixError);
    expect(() => documentObservationRules('')).toThrow(InvalidRulePrefixError);
  });

  describe('the order, which is the part that carries legal meaning', () => {
    it('flags an illegible document ahead of language it cannot trust', () => {
      const r = classifyWith('fl', {
        ...base,
        documentLegible: false,
        hasPerpetualLanguage: true,
      });
      expect(r.ruleId).toBe('fl-illegible-document');
    });

    it('flags a document saying both perpetual and a term, rather than picking one', () => {
      const r = classifyWith('fl', {
        ...base,
        hasPerpetualLanguage: true,
        hasTermOrConditionSubsequent: true,
      });
      expect(r.ruleId).toBe('fl-conflicting-duration-clauses');
    });

    it('will not state a duration for a document whose easement character is unknown', () => {
      const r = classifyWith('fl', {
        ...base,
        easementType: 'unknown',
        hasPerpetualLanguage: true,
      });
      expect(r.ruleId).toBe('fl-unknown-easement-type');
    });

    it('reads an express term and an express perpetual as clear', () => {
      expect(classifyWith('fl', { ...base, hasTermOrConditionSubsequent: true })).toMatchObject({
        tier: 'clear',
        ruleId: 'fl-express-term-limited',
        value: { basis: 'term-limited' },
      });
      expect(classifyWith('fl', { ...base, hasPerpetualLanguage: true })).toMatchObject({
        tier: 'clear',
        ruleId: 'fl-express-perpetual',
        value: { basis: 'perpetual-express' },
      });
    });
  });

  describe('the extraction out of ca-rule-set.ts', () => {
    it('leaves California\'s ids and their order byte-identical', () => {
      // These five ids are written into audit records already on disk. If this
      // fails, records naming a rule that no longer exists have been created,
      // and the fix is to restore the ids rather than to update this list.
      expect(CA_DURATION_RULE_SET.slice(0, 5).map((r) => r.id)).toEqual([
        'ca-illegible-document',
        'ca-conflicting-duration-clauses',
        'ca-unknown-easement-type',
        'ca-express-term-limited',
        'ca-express-perpetual',
      ]);
    });

    it('leaves California\'s three doctrinal rules after them, still doctrinal', () => {
      const doctrine = CA_DURATION_RULE_SET.filter((r) => r.claimType === 'state-doctrine');
      expect(doctrine.map((r) => r.id)).toEqual([
        'ca-appurtenant-default-presumption',
        'ca-prescriptive-default-presumption',
        'ca-in-gross-default-presumption',
      ]);
      // Observation rules first, doctrine after: an express statement in the
      // document must beat a presumption about what the document omits.
      expect(CA_DURATION_RULE_SET.slice(0, 5).every((r) => r.claimType === 'observation')).toBe(
        true,
      );
    });

    it('gives two states disjoint ids, so an audit record names exactly one rule', () => {
      const ca = new Set(documentObservationRules('ca').map((r) => r.id));
      const fl = documentObservationRules('fl').map((r) => r.id);
      expect(fl.some((id) => ca.has(id))).toBe(false);
    });
  });
});
