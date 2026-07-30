import { describe, it, expect } from 'vitest';
import {
  calibratedRange,
  CalibrationError,
  COMBINED_APE_PERCENTILES,
  describeCalibration,
  isRangeInformative,
  REPORTABLE_COVERAGE,
} from './calibrated-range';

describe('calibration constants', () => {
  it('matches the measured back-test percentiles', () => {
    // These are measurements from docs/backtest-zip-land-share.md §4.3, not
    // tuning parameters. If this test is failing because someone tightened a
    // number to make an interval look better, that is the bug.
    expect(COMBINED_APE_PERCENTILES[50]).toBe(0.193);
    expect(COMBINED_APE_PERCENTILES[90]).toBe(0.76);
    expect(COMBINED_APE_PERCENTILES[95]).toBe(1.51);
  });

  it('increases monotonically with coverage', () => {
    const levels = [10, 25, 50, 75, 90, 95] as const;
    for (let i = 1; i < levels.length; i++) {
      expect(COMBINED_APE_PERCENTILES[levels[i]!]).toBeGreaterThan(
        COMBINED_APE_PERCENTILES[levels[i - 1]!],
      );
    }
  });
});

describe('calibratedRange', () => {
  it('derives the interval by inverting the error definition', () => {
    // APE is |predicted - actual| / actual, so the bound on `actual` is
    // P/(1+e) .. P/(1-e), NOT P*(1±e).
    const r = calibratedRange(100_000, 50);
    expect(r.low).toBeCloseTo(100_000 / 1.193, 6);
    expect(r.high!).toBeCloseTo(100_000 / 0.807, 6);
  });

  it('produces an asymmetric interval', () => {
    // The high side is further from the point estimate than the low side.
    // A symmetric interval would overstate precision above the estimate.
    const r = calibratedRange(100_000, 90);
    const below = r.pointEstimate - r.low;
    const above = r.high! - r.pointEstimate;
    expect(above).toBeGreaterThan(below);
  });

  it('reports the upper bound as unbounded when error exceeds 100%', () => {
    // At 95% coverage the measured APE is 151%, so there is no finite upper
    // bound. Suppressing this would misrepresent the method's reach.
    const r = calibratedRange(100_000, 95);
    expect(r.highUnbounded).toBe(true);
    expect(r.high).toBeNull();
    expect(isRangeInformative(r)).toBe(false);
  });

  it('is informative at 90% coverage but not 95%', () => {
    expect(isRangeInformative(calibratedRange(100_000, 90))).toBe(true);
    expect(isRangeInformative(calibratedRange(100_000, 95))).toBe(false);
  });

  it('widens as coverage increases', () => {
    const widths = REPORTABLE_COVERAGE.filter((c) => c !== 95).map((c) => {
      const r = calibratedRange(100_000, c);
      return r.high! - r.low;
    });
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
    }
  });

  it('rejects a non-positive estimate', () => {
    expect(() => calibratedRange(0)).toThrow(CalibrationError);
    expect(() => calibratedRange(-5)).toThrow(CalibrationError);
    expect(() => calibratedRange(Number.NaN)).toThrow(CalibrationError);
  });

  it('defaults to 90% coverage', () => {
    expect(calibratedRange(100_000).coverage).toBe(90);
  });
});

describe('describeCalibration', () => {
  it('discloses the two systematic biases a global range cannot express', () => {
    // Both were measured (§5.2). A range that looks correct while hiding a
    // known signed error by sub-population would be worse than no range.
    const text = describeCalibration(calibratedRange(100_000, 90));
    expect(text).toMatch(/price level/i);
    expect(text).toMatch(/cheapest fifth/i);
    expect(text).toMatch(/dearest fifth/i);
  });

  it('refuses to call the output an appraisal', () => {
    expect(describeCalibration(calibratedRange(100_000))).toMatch(/not an appraisal/i);
  });

  it('says so plainly when the upper bound is unbounded', () => {
    expect(describeCalibration(calibratedRange(100_000, 95))).toMatch(/unbounded/i);
  });
});
