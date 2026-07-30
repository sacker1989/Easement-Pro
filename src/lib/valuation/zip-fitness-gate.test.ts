import { describe, it, expect } from 'vitest';
import {
  assessZipFitness,
  FAILING_ZIP_IQR,
  mayEmitEstimate,
  MIN_COHORT_SIZE,
  percentile,
  PROVISIONAL_IQR_THRESHOLD,
  shareIqr,
  SOUND_ZIP_IQR_RANGE,
} from './zip-fitness-gate';

/**
 * Reconstructs 93550's bimodal shape from the subgroup counts in
 * docs/backtest-zip-land-share.md §7.2 — 599 parcels below 0.35 and 722 at or
 * above it, with dense modes at exactly 0.250 and exactly 0.700.
 *
 * This is the SHAPE, not the county's actual sample, so the test asserts the
 * gate's decision rather than reproducing the measured IQR of 0.299 exactly.
 */
function palmdaleLikeShares(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 373; i++) out.push(0.25);
  for (let i = 0; i < 226; i++) out.push(0.25 + (i % 9) * 0.01);
  for (let i = 0; i < 194; i++) out.push(0.7);
  for (let i = 0; i < 528; i++) out.push(0.68 + (i % 11) * 0.01);
  return out;
}

/** A well-behaved ZIP: tight around 0.70, IQR inside the observed sound band. */
function soundZipShares(): number[] {
  const out: number[] = [];
  for (let i = 0; i < 400; i++) out.push(0.64 + (i % 13) * 0.01);
  return out;
}

describe('percentile', () => {
  it('interpolates linearly between order statistics', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
    expect(percentile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
  });

  it('handles a single-element sample', () => {
    expect(percentile([0.7], 0.5)).toBe(0.7);
  });

  it('throws on an empty sample rather than returning NaN', () => {
    expect(() => percentile([], 0.5)).toThrow(/empty/);
  });
});

describe('the gate catches the ZIP it was built for', () => {
  it('rejects a Palmdale-shaped bimodal distribution', () => {
    // This is the regression test for the whole module. 93550's median share
    // is meaningless because the distribution has two separated modes, and
    // nothing else in the parcel record reveals that.
    const result = assessZipFitness(palmdaleLikeShares());
    expect(result.status).toBe('unfit');
    if (result.status === 'unfit') {
      expect(result.iqr).toBeGreaterThan(PROVISIONAL_IQR_THRESHOLD);
      expect(result.reason).toMatch(/interquartile range/);
      expect(result.reason).toMatch(/No land-value estimate is offered/);
    }
  });

  it('emits no estimate for an unfit ZIP', () => {
    expect(mayEmitEstimate(assessZipFitness(palmdaleLikeShares()))).toBe(false);
  });

  it('accepts a well-behaved ZIP', () => {
    const result = assessZipFitness(soundZipShares());
    expect(result.status).toBe('sound');
    if (result.status === 'sound') {
      expect(result.iqr).toBeLessThan(PROVISIONAL_IQR_THRESHOLD);
      expect(result.medianShare).toBeGreaterThan(0.6);
    }
    expect(mayEmitEstimate(result)).toBe(true);
  });

  it('separates the sound band from the observed failure', () => {
    // Sanity check on the recorded evidence: the threshold must sit strictly
    // between the sound ZIPs and the failing one, or it is not a boundary.
    expect(SOUND_ZIP_IQR_RANGE.max).toBeLessThan(PROVISIONAL_IQR_THRESHOLD);
    expect(FAILING_ZIP_IQR).toBeGreaterThan(PROVISIONAL_IQR_THRESHOLD);
  });
});

describe('cohort size', () => {
  it('refuses a cohort below the minimum rather than guessing', () => {
    const result = assessZipFitness(new Array(MIN_COHORT_SIZE - 1).fill(0.7));
    expect(result.status).toBe('insufficient-data');
    if (result.status === 'insufficient-data') {
      expect(result.reason).toMatch(/at least 30/);
    }
  });

  it('discards shares outside (0,1) before counting', () => {
    // A share of 0 or 1 means one side of the split is missing, which is a
    // data defect, not a parcel that is all land or all improvement.
    const bad = [...new Array(20).fill(0.7), ...new Array(20).fill(0), ...new Array(20).fill(1)];
    const result = assessZipFitness(bad);
    expect(result.status).toBe('insufficient-data');
    if (result.status === 'insufficient-data') expect(result.n).toBe(20);
  });
});

describe('shareIqr', () => {
  it('does not mutate its input', () => {
    const input = [0.9, 0.1, 0.5];
    shareIqr(input);
    expect(input).toEqual([0.9, 0.1, 0.5]);
  });
});
