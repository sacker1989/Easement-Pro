import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';
import {
  buildValuationEstimate,
  IMPACT_TIER_BY_TYPE,
  IRWA_METHOD_DISCLOSURE,
  STRIP_ONLY_WARNING,
  WHOLE_PARCEL_TYPES,
  type ValuationEstimateInputs,
} from './build-valuation-estimate';
import { IMPACT_TIERS } from './valuation-matrix';
import { SCREENING_BAND_BY_TYPE } from './screening-estimate';

type BaseInputs = Omit<ValuationEstimateInputs, 'easementType'>;

// Typed explicitly rather than inferred: inference narrows these to non-null
// numbers, and half the tests below exist to pass null.
const BASE: BaseInputs = {
  lotAreaSqFt: 8000,
  easementAreaSqFt: 800,
  landValuePerSqFt: 150,
  valueSource: 'LA County Assessor 2026 roll',
};

function estimate(easementType: EasementType, overrides: Partial<BaseInputs> = {}) {
  return buildValuationEstimate({ easementType, ...BASE, ...overrides });
}

describe('it refuses exactly where the screening estimate refuses', () => {
  it('refuses every type the screening module refuses, in its words', () => {
    /*
     * THE CONSISTENCY THAT MATTERS MOST. A report showing "no estimate is
     * possible for a pipeline" beside "here is a pipeline estimate" would be
     * worse than either alone, and the reasons the screening module gives do
     * not stop being true because a different method is applied.
     */
    for (const type of EASEMENT_TYPES) {
      const band = SCREENING_BAND_BY_TYPE[type];
      const hasRefusal = 'refusal' in band && band.refusal !== undefined;
      const result = estimate(type);
      if (hasRefusal) {
        expect(result.kind, `${type} should be refused`).toBe('refused');
        if (result.kind !== 'refused') continue;
        // Quoted, not paraphrased — one source of truth.
        expect(result.reason).toBe(band.refusal);
      } else {
        expect(result.kind, `${type} should produce an estimate`).toBe('estimated');
      }
    }
  });

  it('refuses the four known types', () => {
    for (const type of ['conservation', 'pipeline', 'slope', 'prescriptive'] as const) {
      expect(estimate(type).kind).toBe('refused');
    }
  });

  it('refuses before reading any other input', () => {
    // However the inputs are shaped, a refused type cannot produce a figure.
    const result = buildValuationEstimate({
      easementType: 'pipeline',
      lotAreaSqFt: null,
      easementAreaSqFt: null,
      landValuePerSqFt: null,
      valueSource: 'none',
    });
    expect(result.kind).toBe('refused');
  });
});

describe('the tier mapping', () => {
  it('covers every easement type', () => {
    for (const type of EASEMENT_TYPES) {
      expect(IMPACT_TIER_BY_TYPE[type], `${type} has no tier`).toBeDefined();
      expect(IMPACT_TIERS[IMPACT_TIER_BY_TYPE[type]]).toBeDefined();
    }
  });

  it('reads the tiers’ own descriptions rather than inventing a judgement', () => {
    // severe names "overhead electric"; balanced names "sewer/water lines";
    // major names "drainage". If these drift, the mapping has stopped being a
    // reading of the matrix and become an opinion layered on top of it.
    expect(IMPACT_TIERS[IMPACT_TIER_BY_TYPE['utility-overhead']]!.description).toMatch(
      /overhead electric/i,
    );
    expect(IMPACT_TIERS[IMPACT_TIER_BY_TYPE.sewer]!.description).toMatch(/sewer\/water lines/i);
    expect(IMPACT_TIERS[IMPACT_TIER_BY_TYPE.drainage]!.description).toMatch(/drainage/i);
  });
});

describe('the estimate itself', () => {
  it('returns a range from the tier bounds, not a midpoint', () => {
    // resolveImpactPercentage returns a midpoint, which would read as one
    // confident number. The tiers are bands. Same reason screening-estimate
    // has no pointEstimate field.
    const r = estimate('utility-overhead');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.low.impactPercent).toBe(r.tier.lowPercent);
    expect(r.high.impactPercent).toBe(r.tier.highPercent);
    expect(r.high.result.totalCompensation).toBeGreaterThan(r.low.result.totalCompensation);
  });

  it('prices the strip: area x land value x impact percent', () => {
    // utility-overhead is 'severe', 90-100%.
    const r = estimate('utility-overhead');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.low.result.totalCompensation).toBeCloseTo(800 * 150 * 0.9, 2);
    expect(r.high.result.totalCompensation).toBeCloseTo(800 * 150 * 1.0, 2);
  });

  it('gives a lower figure for a buried line than an overhead one', () => {
    // The mapping has to produce a difference a homeowner would recognise:
    // a line overhead across the yard is worse than one along the boundary.
    const overhead = estimate('utility-overhead');
    const buried = estimate('utility-underground');
    if (overhead.kind !== 'estimated' || buried.kind !== 'estimated') throw new Error('expected');
    expect(buried.high.result.totalCompensation).toBeLessThan(
      overhead.low.result.totalCompensation,
    );
  });

  it('carries the value source through verbatim', () => {
    const r = estimate('sewer');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.valueSource).toBe('LA County Assessor 2026 roll');
  });
});

describe('Before-and-After is not computed from our own assumptions', () => {
  it('reports what is missing instead of deriving it', () => {
    /*
     * THE DECISION THIS FILE MOST NEEDS TO HOLD. Deriving the after-value from
     * the same impact percentage the Summation uses gives two methods that
     * agree because one is algebraically the other. That reads as
     * corroboration and is not — it is the same number twice, wearing two
     * names.
     */
    const r = estimate('utility-overhead');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.beforeAndAfter.kind).toBe('needs-appraiser');
    if (r.beforeAndAfter.kind !== 'needs-appraiser') return;
    expect(r.beforeAndAfter.missingInput).toMatch(/appraised value/i);
    expect(r.beforeAndAfter.whyNotDerived).toMatch(/arithmetic of the other/i);
  });

  it('runs when a real appraised remainder value is supplied', async () => {
    const r = buildValuationEstimate({
      easementType: 'utility-overhead',
      ...BASE,
      appraisedRemainderValuePerSqFt: 120,
    });
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.beforeAndAfter.kind).toBe('computed');
    if (r.beforeAndAfter.kind !== 'computed') return;
    // whole (8000 x 150) minus remainder (8000 x 120)
    expect(r.beforeAndAfter.totalCompensation).toBeCloseTo(8000 * 150 - 8000 * 120, 2);
  });

  it('ignores a nonsensical appraised value rather than computing from it', async () => {
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      const r = buildValuationEstimate({
        easementType: 'sewer',
        ...BASE,
        appraisedRemainderValuePerSqFt: bad,
      });
      if (r.kind !== 'estimated') throw new Error('expected estimated');
      expect(r.beforeAndAfter.kind, `${bad} should not compute`).toBe('needs-appraiser');
    }
  });
});

describe('the whole-parcel gap is named rather than hidden', () => {
  it('flags access easements as strip-only', () => {
    for (const type of ['access-ingress-egress', 'public-right-of-way'] as const) {
      const r = estimate(type);
      if (r.kind !== 'estimated') throw new Error('expected estimated');
      expect(r.stripOnly, `${type} should be strip-only`).toBe(true);
    }
  });

  it('does not flag a boundary utility as strip-only', () => {
    const r = estimate('utility-underground');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.stripOnly).toBe(false);
  });

  it('says the omitted number is usually the bigger one', () => {
    // For a driveway easement the whole-parcel effect is most of the answer,
    // and screening-estimate reflects that by denominating access against
    // TOTAL property value. Summation can only price the part acquired, so
    // the omission has to be stated rather than left as a silent floor.
    expect(STRIP_ONLY_WARNING).toMatch(/rest of the parcel/i);
    expect(STRIP_ONLY_WARNING).toMatch(/bigger number/i);
    expect(WHOLE_PARCEL_TYPES.has('access-ingress-egress')).toBe(true);
  });
});

describe('inputs that cannot produce a figure', () => {
  it('is unavailable without area, value or easement area', () => {
    expect(estimate('sewer', { lotAreaSqFt: null }).kind).toBe('unavailable');
    expect(estimate('sewer', { landValuePerSqFt: null }).kind).toBe('unavailable');
    expect(estimate('sewer', { easementAreaSqFt: null }).kind).toBe('unavailable');
    expect(estimate('sewer', { landValuePerSqFt: 0 }).kind).toBe('unavailable');
  });

  it('catches an easement larger than the lot as a question, not a crash', () => {
    // The calculator throws on this, and it is a reachable user input: the
    // form takes both figures from the homeowner when no county geometry
    // matched. It must read as a question about their numbers.
    const r = estimate('sewer', { easementAreaSqFt: 9000, lotAreaSqFt: 8000 });
    expect(r.kind).toBe('unavailable');
    if (r.kind !== 'unavailable') return;
    expect(r.reason).toMatch(/larger than the lot/i);
    expect(r.reason).toMatch(/9,000/);
  });

  it('never throws for any type on any degenerate input', () => {
    // A page that has to try/catch to render a section eventually renders
    // nothing instead.
    for (const type of EASEMENT_TYPES) {
      for (const bad of [
        { lotAreaSqFt: null },
        { landValuePerSqFt: null },
        { easementAreaSqFt: null },
        { lotAreaSqFt: -1 },
        { easementAreaSqFt: 1e9 },
      ]) {
        expect(() => estimate(type, bad), `${type} ${JSON.stringify(bad)}`).not.toThrow();
      }
    }
  });
});

describe('the method disclosure', () => {
  it('names the standard that rejects this method', () => {
    // A reader who sees "IRWA Summation Method" and concludes the number is
    // appraisal-grade has been misled. The disclosure has to say so itself
    // rather than relying on a banner elsewhere on the page.
    expect(IRWA_METHOD_DISCLOSURE).toMatch(/4\.6\.5/);
    expect(IRWA_METHOD_DISCLOSURE).toMatch(/rejects percentage-of-fee/i);
  });

  it('admits the percentages are unverified', () => {
    expect(IRWA_METHOD_DISCLOSURE).toMatch(/has not been able to verify/i);
  });

  it('says naming the method does not make it an appraisal', () => {
    expect(IRWA_METHOD_DISCLOSURE).toMatch(/does not make the number an appraisal/i);
  });

  it('is attached to every estimate', () => {
    const r = estimate('sewer');
    if (r.kind !== 'estimated') throw new Error('expected estimated');
    expect(r.methodDisclosure).toBe(IRWA_METHOD_DISCLOSURE);
  });
});
