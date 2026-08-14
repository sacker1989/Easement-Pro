import { describe, it, expect } from 'vitest';
import {
  assertObservedRate,
  TemporaryEasementError,
  valueTemporaryEasement,
  type MarketRentRate,
} from './temporary-easement';

const RATE: MarketRentRate = {
  perSqFtPerYear: 0.85,
  source: 'Three comparable ground leases on adjacent industrial parcels, 2026 Q1 market study',
  observedOn: '2026-03-31',
};

describe('the rate must be observed, never derived', () => {
  it('rejects a rate with no provenance', () => {
    expect(() => assertObservedRate({ ...RATE, source: 'est.' })).toThrow(/naming where it was observed/);
  });

  it('rejects a rate derived from fee value', () => {
    // §4.7: improper to opine market rental value from the underlying fee.
    // Federal courts reject it even where comparable leases are unavailable,
    // so "we had no comparables" is not a defence.
    for (const s of [
      'Capitalized land value at 8%',
      '6% of fee value per year',
      'derived from land value using a market cap rate',
      'land value x 0.07 annually',
    ]) {
      expect(() => assertObservedRate({ ...RATE, source: s })).toThrow(/improper to develop/);
    }
  });

  it('rejects a non-positive or non-finite rate', () => {
    expect(() => assertObservedRate({ ...RATE, perSqFtPerYear: 0 })).toThrow(TemporaryEasementError);
    expect(() => assertObservedRate({ ...RATE, perSqFtPerYear: Number.NaN })).toThrow(
      TemporaryEasementError,
    );
  });

  it('requires an ISO observation date', () => {
    expect(() => assertObservedRate({ ...RATE, observedOn: 'March 2026' })).toThrow(/ISO observation date/);
  });

  it('accepts a properly sourced rate', () => {
    expect(() => assertObservedRate(RATE)).not.toThrow();
  });
});

describe('valueTemporaryEasement', () => {
  it('computes rent x area x term', () => {
    const v = valueTemporaryEasement({ areaSqFt: 1204, termYears: 2, rate: RATE });
    expect(v.annualRent).toBeCloseTo(1204 * 0.85, 6);
    expect(v.grossRent).toBeCloseTo(1204 * 0.85 * 2, 6);
    expect(v.compensation).toBeCloseTo(1204 * 0.85 * 2, 6);
  });

  it('handles a sub-year term', () => {
    // A 9-month construction easement is 0.75 years.
    const v = valueTemporaryEasement({ areaSqFt: 1000, termYears: 0.75, rate: RATE });
    expect(v.compensation).toBeCloseTo(1000 * 0.85 * 0.75, 6);
  });

  it('assumes full exclusion by default', () => {
    // The assumption that does not understate the owner's claim.
    const v = valueTemporaryEasement({ areaSqFt: 1000, termYears: 1, rate: RATE });
    expect(v.retainedUseShare).toBe(0);
    expect(v.note).toMatch(/does not understate the claim/);
  });

  it('reduces compensation for use the owner retains', () => {
    const full = valueTemporaryEasement({ areaSqFt: 1000, termYears: 1, rate: RATE });
    const part = valueTemporaryEasement({
      areaSqFt: 1000,
      termYears: 1,
      rate: RATE,
      retainedUseShare: 0.25,
    });
    expect(part.compensation).toBeCloseTo(full.compensation * 0.75, 6);
  });

  it('rejects a retained share of 1 or more', () => {
    // The owner losing nothing is not a compensable easement.
    expect(() =>
      valueTemporaryEasement({ areaSqFt: 1000, termYears: 1, rate: RATE, retainedUseShare: 1 }),
    ).toThrow(/not a compensable easement/);
  });

  it('does not discount unless asked', () => {
    const v = valueTemporaryEasement({ areaSqFt: 1000, termYears: 5, rate: RATE });
    expect(v.discountRate).toBeNull();
    expect(v.grossRent).toBeCloseTo(1000 * 0.85 * 5, 6);
    expect(v.note).toMatch(/not discounted to present value/);
  });

  it('applies an annuity factor when a discount rate is given', () => {
    const r = 0.06;
    const v = valueTemporaryEasement({ areaSqFt: 1000, termYears: 5, rate: RATE, discountRate: r });
    const af = (1 - Math.pow(1 + r, -5)) / r;
    expect(v.grossRent).toBeCloseTo(1000 * 0.85 * af, 6);
    // Discounting must reduce, never increase.
    expect(v.grossRent).toBeLessThan(1000 * 0.85 * 5);
  });

  it('rejects non-positive area or term', () => {
    expect(() => valueTemporaryEasement({ areaSqFt: 0, termYears: 1, rate: RATE })).toThrow(
      /positive number of square feet/,
    );
    expect(() => valueTemporaryEasement({ areaSqFt: 100, termYears: 0, rate: RATE })).toThrow(
      /positive number of years/,
    );
  });

  it('validates the rate as part of valuing', () => {
    expect(() =>
      valueTemporaryEasement({
        areaSqFt: 100,
        termYears: 1,
        rate: { ...RATE, source: 'capitalized land value at 7%' },
      }),
    ).toThrow(/improper to develop/);
  });
});

describe('hypothetical rates announce themselves', () => {
  it('marks an illustrative figure loudly', () => {
    // A source string alone cannot carry this — a caller can write anything
    // there and the output still reads as measured.
    const v = valueTemporaryEasement({
      areaSqFt: 1204,
      termYears: 2,
      rate: { ...RATE, hypothetical: true },
    });
    expect(v.note).toMatch(/ILLUSTRATIVE, NOT OBSERVED/);
    expect(v.note).toMatch(/not a compensation estimate/);
  });

  it('says nothing extra when the rate is real', () => {
    expect(valueTemporaryEasement({ areaSqFt: 1204, termYears: 2, rate: RATE }).note).not.toMatch(
      /ILLUSTRATIVE/,
    );
  });

  it('still computes the same arithmetic either way', () => {
    const a = valueTemporaryEasement({ areaSqFt: 1000, termYears: 1, rate: RATE });
    const b = valueTemporaryEasement({
      areaSqFt: 1000,
      termYears: 1,
      rate: { ...RATE, hypothetical: true },
    });
    expect(b.compensation).toBe(a.compensation);
  });
});

describe('what the note says', () => {
  const v = valueTemporaryEasement({ areaSqFt: 1204, termYears: 2, rate: RATE });

  it('cites the controlling section', () => {
    expect(v.note).toMatch(/§4\.6\.5\.1\.2/);
  });

  it('carries the rate provenance into the output', () => {
    expect(v.note).toContain(RATE.source);
    expect(v.note).toContain(RATE.observedOn);
  });

  it('refuses to call itself an appraisal', () => {
    expect(v.note).toMatch(/not an appraisal/);
  });

  it('disclaims the permanent case, which has no runnable formula', () => {
    expect(v.note).toMatch(/does not address any\s+permanent easement or damage to the remainder/);
  });
});
