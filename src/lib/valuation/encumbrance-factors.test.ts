import { describe, it, expect } from 'vitest';
import { EASEMENT_TYPES, provenanceConfidence } from '@/lib/easements/easement-types';
import {
  BEFORE_AND_AFTER_METHODOLOGY_NOTE,
  ENCUMBRANCE_FACTORS,
  lookupEncumbranceFactor,
  TTI_PIPELINE_CASE_EXAMPLE,
  UNCITED_SCREENING_RANGES,
  VALUATION_METHODS,
} from './encumbrance-factors';

describe('encumbrance factor sourcing discipline', () => {
  it('offers no number for an unsourced easement type', () => {
    // The whole point of the module: no fallback percentage exists.
    const result = lookupEncumbranceFactor('utility-overhead');
    expect(result.status).toBe('unsourced');
    if (result.status === 'unsourced') {
      expect(result.explanation).toMatch(/before-and-after/i);
      expect(result.explanation).toMatch(/not market value/i);
    }
  });

  it('has an entry for every easement type', () => {
    // A missing key would fall through to `undefined` and could be mistaken
    // for "no easement" rather than "no sourced factor".
    for (const t of EASEMENT_TYPES) {
      expect(ENCUMBRANCE_FACTORS[t]).toBeDefined();
      expect(ENCUMBRANCE_FACTORS[t]!.type).toBe(t);
    }
  });

  it('carries no factor value on any unsourced entry', () => {
    // Guards against someone adding a number without a citation.
    for (const t of EASEMENT_TYPES) {
      const e = ENCUMBRANCE_FACTORS[t]!;
      if (e.basis.kind === 'unsourced') {
        expect(e.factor).toBeUndefined();
        expect(e.range).toBeUndefined();
      }
    }
  });

  it('requires a citation and retrieval date on any published figure', () => {
    for (const t of EASEMENT_TYPES) {
      const b = ENCUMBRANCE_FACTORS[t]!.basis;
      if (b.kind === 'published-screening') {
        expect(b.citation.length).toBeGreaterThan(20);
        expect(b.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(b.appliesTo.length).toBeGreaterThan(20);
      }
    }
  });
});

describe('TTI pipeline case example', () => {
  it('records the sourced figure with its citation', () => {
    expect(TTI_PIPELINE_CASE_EXAMPLE.factor).toBeCloseTo(0.614, 3);
    expect(TTI_PIPELINE_CASE_EXAMPLE.basis.kind).toBe('published-screening');
  });

  it('states the limits that stop it being used as a general factor', () => {
    // It is one worked example for a 16-inch pipe in a 12-ft easement, not a
    // row in a lookup table.
    if (TTI_PIPELINE_CASE_EXAMPLE.basis.kind === 'published-screening') {
      expect(TTI_PIPELINE_CASE_EXAMPLE.basis.appliesTo).toMatch(/not a general factor/i);
      expect(TTI_PIPELINE_CASE_EXAMPLE.basis.appliesTo).toMatch(/16-inch/);
    }
  });

  it('is NOT wired into the lookup table', () => {
    // Deliberate: a single case example must not silently become the default
    // factor for every pipeline easement.
    expect(lookupEncumbranceFactor('pipeline').status).toBe('unsourced');
  });
});

describe('guide ranges are recorded but not adopted', () => {
  it('keeps the uncited ranges out of the lookup', () => {
    // The guide gives utility 25-75% of fee. That must not become a factor:
    // it has no citation, and percentage-of-fee is the method the literature
    // rejects. Recording it is fine; using it is not.
    expect(UNCITED_SCREENING_RANGES['utility']!.low).toBe(0.25);
    expect(UNCITED_SCREENING_RANGES['utility']!.high).toBe(0.75);
    expect(lookupEncumbranceFactor('utility-overhead').status).toBe('unsourced');
    expect(lookupEncumbranceFactor('drainage').status).toBe('unsourced');
    expect(lookupEncumbranceFactor('access-ingress-egress').status).toBe('unsourced');
    expect(lookupEncumbranceFactor('conservation').status).toBe('unsourced');
  });

  it('records what each range is a share OF', () => {
    // Access is a share of TOTAL property value; utility is a share of LAND
    // value. Mixing those up changes the answer by an order of magnitude.
    expect(UNCITED_SCREENING_RANGES['access']!.basis).toMatch(/TOTAL property value/);
    expect(UNCITED_SCREENING_RANGES['utility']!.basis).toMatch(/land value/);
  });
});

describe('VALUATION_METHODS', () => {
  it('names before-and-after as the controlling method', () => {
    expect(VALUATION_METHODS.beforeAndAfter).toMatch(/Federal Rule/);
    expect(VALUATION_METHODS.beforeAndAfter).toMatch(/difference is the easement value/);
  });

  it('warns that sales OF easements are not valid comparables', () => {
    expect(VALUATION_METHODS.salesComparison).toMatch(/not valid comparables/);
  });

  it('requires observed rents for the income approach, not a percentage', () => {
    expect(VALUATION_METHODS.incomeCapitalisation).toMatch(/not a\s+percentage of fee value/);
  });
});

describe('methodology note', () => {
  it('states the before-and-after rule and cites it', () => {
    expect(BEFORE_AND_AFTER_METHODOLOGY_NOTE).toMatch(/before-and-after/i);
    expect(BEFORE_AND_AFTER_METHODOLOGY_NOTE).toMatch(/International Right of Way Association/);
  });

  it('refuses to call the output an appraisal', () => {
    expect(BEFORE_AND_AFTER_METHODOLOGY_NOTE).toMatch(/not an appraisal/i);
  });
});

describe('provenanceConfidence', () => {
  it('treats a recorded instrument as verified', () => {
    expect(provenanceConfidence({ kind: 'recorded-document', instrumentNo: '2019-004321' })).toBe(
      'verified',
    );
  });

  it('treats proximity as flagged, not merely inferred', () => {
    // A transmission line 300 ft away must not produce a dollar figure.
    expect(
      provenanceConfidence({ kind: 'proximity-inference', distanceFt: 300, layer: 'HIFLD' }),
    ).toBe('flagged');
  });

  it('treats a user assertion as flagged', () => {
    expect(provenanceConfidence({ kind: 'user-asserted' })).toBe('flagged');
  });
});
