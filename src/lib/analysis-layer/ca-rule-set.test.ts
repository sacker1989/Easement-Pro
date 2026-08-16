import { describe, expect, it } from 'vitest';
import { classifyByRules } from './confidence-tiering';
import {
  CA_DURATION_FALLBACK,
  CA_DURATION_RULE_SET,
  type CaDurationBasis,
  type EasementDurationFacts,
} from './ca-rule-set';
import type { ExpressDurationBasis } from './duration-basis';

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

describe('CA doctrine stays out of the shared vocabulary', () => {
  it('keeps state presumptions off ExpressDurationBasis', () => {
    // ExpressDurationBasis reports what the INSTRUMENT says and must hold in
    // any jurisdiction. The three values below are California legal
    // PRESUMPTIONS, and another state may presume the opposite or nothing.
    // The suppression directives are the assertion: hoist any of these back
    // into the shared union and the errors vanish, at which point tsc fails
    // on the now-unused directives.

    // @ts-expect-error CA presumption, not an instrument-derived basis
    const appurtenant: ExpressDurationBasis = 'perpetual-appurtenant-default';
    // @ts-expect-error CA presumption, not an instrument-derived basis
    const prescriptive: ExpressDurationBasis = 'perpetual-prescriptive-default';
    // @ts-expect-error CA presumption, not an instrument-derived basis
    const inGross: ExpressDurationBasis = 'life-of-grantee';

    expect([appurtenant, prescriptive, inGross]).toHaveLength(3);
  });

  it('accepts instrument-derived bases in both the shared and CA unions', () => {
    const shared: ExpressDurationBasis = 'perpetual-express';
    const widened: CaDurationBasis = shared;
    const term: CaDurationBasis = 'term-limited';
    expect([widened, term]).toEqual(['perpetual-express', 'term-limited']);
  });

  it('produces only CA-declared bases from the CA rule set', () => {
    // Every basis the rules can emit must be in CaDurationBasis. This is the
    // runtime half of the same guarantee.
    const allowed = new Set([
      'perpetual-express',
      'term-limited',
      'perpetual-appurtenant-default',
      'perpetual-prescriptive-default',
      'life-of-grantee',
    ]);
    const cases: EasementDurationFacts[] = [
      { easementType: 'appurtenant', hasPerpetualLanguage: true, hasTermOrConditionSubsequent: false, documentLegible: true },
      { easementType: 'appurtenant', hasPerpetualLanguage: false, hasTermOrConditionSubsequent: true, documentLegible: true },
      { easementType: 'appurtenant', hasPerpetualLanguage: false, hasTermOrConditionSubsequent: false, documentLegible: true },
      { easementType: 'prescriptive', hasPerpetualLanguage: false, hasTermOrConditionSubsequent: false, documentLegible: true },
      { easementType: 'in-gross', hasPerpetualLanguage: false, hasTermOrConditionSubsequent: false, documentLegible: true },
    ];
    for (const facts of cases) {
      const r = classify(facts);
      if ('value' in r && r.value) expect(allowed.has(r.value.basis)).toBe(true);
    }
  });
});
