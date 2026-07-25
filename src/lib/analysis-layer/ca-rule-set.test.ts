import { describe, expect, it } from 'vitest';
import { classifyByRules } from './confidence-tiering';
import { CA_DURATION_FALLBACK, CA_DURATION_RULE_SET, type EasementDurationFacts } from './ca-rule-set';

function classify(facts: EasementDurationFacts) {
  return classifyByRules(facts, CA_DURATION_RULE_SET, CA_DURATION_FALLBACK);
}

const base: EasementDurationFacts = {
  easementType: 'appurtenant',
  hasPerpetualLanguage: false,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('CA_DURATION_RULE_SET', () => {
  it('flags an illegible document before checking anything else', () => {
    const result = classify({ ...base, documentLegible: false, hasPerpetualLanguage: true });
    expect(result.tier).toBe('flagged-ambiguous');
    expect(result.ruleId).toBe('ca-illegible-document');
  });

  it('flags conflicting perpetual and term-limited language', () => {
    const result = classify({ ...base, hasPerpetualLanguage: true, hasTermOrConditionSubsequent: true });
    expect(result.tier).toBe('flagged-ambiguous');
    expect(result.ruleId).toBe('ca-conflicting-duration-clauses');
  });

  it('flags an unknown easement type with no express duration language', () => {
    const result = classify({ ...base, easementType: 'unknown' });
    expect(result.tier).toBe('flagged-ambiguous');
    expect(result.ruleId).toBe('ca-unknown-easement-type');
  });

  it('clearly resolves an express term-limited duration', () => {
    const result = classify({ ...base, hasTermOrConditionSubsequent: true });
    expect(result).toMatchObject({ tier: 'clear', ruleId: 'ca-express-term-limited' });
    if (result.tier === 'clear') {
      expect(result.value.basis).toBe('term-limited');
    }
  });

  it('clearly resolves express perpetual language', () => {
    const result = classify({ ...base, hasPerpetualLanguage: true });
    expect(result).toMatchObject({ tier: 'clear', ruleId: 'ca-express-perpetual' });
    if (result.tier === 'clear') {
      expect(result.value.basis).toBe('perpetual-express');
    }
  });

  it('treats a silent appurtenant easement as likely-perpetual with a caveat', () => {
    const result = classify({ ...base, easementType: 'appurtenant' });
    expect(result.tier).toBe('likely-with-caveat');
    expect(result.ruleId).toBe('ca-appurtenant-default-presumption');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.basis).toBe('perpetual-appurtenant-default');
      expect(result.caveat).toBeTruthy();
    }
  });

  it('treats a silent prescriptive easement as likely-perpetual with a caveat', () => {
    const result = classify({ ...base, easementType: 'prescriptive' });
    expect(result.tier).toBe('likely-with-caveat');
    expect(result.ruleId).toBe('ca-prescriptive-default-presumption');
  });

  it('treats a silent in-gross easement as tied to the grantee\'s life, with a caveat', () => {
    const result = classify({ ...base, easementType: 'in-gross' });
    expect(result.tier).toBe('likely-with-caveat');
    expect(result.ruleId).toBe('ca-in-gross-default-presumption');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.basis).toBe('life-of-grantee');
    }
  });
});
