/**
 * Converts a point land-value estimate into a calibrated range.
 *
 * WHY: the back-test (docs/backtest-zip-land-share.md §4.3) measured the
 * end-to-end method at 19.3% median absolute percentage error, p90 76.0%,
 * p95 151.0%, with only 59.8% of parcels landing within ±25%. For a figure
 * meant to price one owner's specific easement, a one-in-ten chance of being
 * off by 76% is a defect, not a caveat. So the product must not emit a bare
 * point estimate. This module is recommendation 1 of that report.
 *
 * The calibration below is MEASURED, not chosen. Every number in
 * COMBINED_APE_PERCENTILES comes from that back-test's §4.3 table, scored on
 * 9,476 recently-reassessed LA County single-family parcels across 16 ZIPs
 * with leave-one-out discipline. Do not adjust these to make an interval look
 * tighter.
 */

/** Absolute-percentage-error percentiles for the full method, from §4.3. */
export const COMBINED_APE_PERCENTILES = {
  10: 0.03,
  25: 0.083,
  50: 0.193,
  75: 0.387,
  90: 0.76,
  95: 1.51,
} as const;

export type CoverageLevel = keyof typeof COMBINED_APE_PERCENTILES;

/** Coverage levels wide enough to be worth reporting. */
export const REPORTABLE_COVERAGE: readonly CoverageLevel[] = [50, 75, 90, 95];

export interface CalibratedRange {
  readonly pointEstimate: number;
  /** Share of parcels the interval is expected to contain, e.g. 90. */
  readonly coverage: CoverageLevel;
  /** The APE percentile the interval was derived from. */
  readonly apeAtCoverage: number;
  readonly low: number;
  /** Null when the interval is unbounded above — see `highUnbounded`. */
  readonly high: number | null;
  /**
   * True when the error at this coverage level reaches or exceeds 100%, which
   * makes the upper bound infinite. At 95% coverage the measured APE is 151%,
   * so the method genuinely cannot bound the top tail. Surfacing that is the
   * point; suppressing it would misrepresent the method's reach.
   */
  readonly highUnbounded: boolean;
}

export class CalibrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalibrationError';
  }
}

/**
 * Derives the interval of plausible ACTUAL values around a point estimate.
 *
 * The measured error is defined as APE = |predicted − actual| / actual, scored
 * against the county's assessed land value. Inverting for `actual`:
 *
 *   |P − A| ≤ e·A   ⇒   A(1−e) ≤ P ≤ A(1+e)
 *                   ⇒   P/(1+e) ≤ A ≤ P/(1−e)
 *
 * Note the asymmetry this produces: the interval is NOT ±e around P. At e=0.76
 * the range runs from 0.57×P to 4.17×P, because an error expressed relative to
 * the actual value bounds under-prediction much more loosely than
 * over-prediction. That asymmetry is a real property of the measurement, and
 * an interval drawn symmetrically around P would overstate the method's
 * precision on the high side.
 *
 * When e ≥ 1 the upper bound diverges and `high` is null.
 */
export function calibratedRange(
  pointEstimate: number,
  coverage: CoverageLevel = 90,
): CalibratedRange {
  if (!Number.isFinite(pointEstimate) || pointEstimate <= 0) {
    throw new CalibrationError('Point estimate must be a positive finite number');
  }

  const ape = COMBINED_APE_PERCENTILES[coverage];
  if (ape === undefined) {
    throw new CalibrationError(`No measured calibration for coverage level ${coverage}`);
  }

  const low = pointEstimate / (1 + ape);
  const highUnbounded = ape >= 1;

  return {
    pointEstimate,
    coverage,
    apeAtCoverage: ape,
    low,
    high: highUnbounded ? null : pointEstimate / (1 - ape),
    highUnbounded,
  };
}

/**
 * Human-readable provenance and limits for the methodology section.
 *
 * States the two limitations the back-test measured that a single global
 * calibration cannot express, because concealing them would let a
 * correct-looking interval carry a known systematic error.
 */
export function describeCalibration(range: CalibratedRange): string {
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
  const bound = range.highUnbounded
    ? 'the upper bound is unbounded at this coverage level, because the measured error exceeds 100%'
    : `up to ${range.high!.toFixed(0)}`;

  return (
    `Range covers ${range.coverage}% of parcels, calibrated from a back-test of 9,476 Los Angeles ` +
    `County parcels (median error ${pct(COMBINED_APE_PERCENTILES[50])}, ` +
    `${pct(COMBINED_APE_PERCENTILES[90])} at the 90th percentile). Lower bound ` +
    `${range.low.toFixed(0)}, ${bound}. ` +
    `The interval is asymmetric because error is measured relative to the true value. ` +
    `Two known limits this range does NOT capture: accuracy degrades with ZIP price level ` +
    `(median error runs about 10-17% below $1M and 42-55% in the most expensive ZIPs tested), and ` +
    `error is systematically signed by a parcel's position within its ZIP — the cheapest fifth are ` +
    `overstated by about 62% at the median and the dearest fifth understated by about 29%. ` +
    `This is a screening estimate, not an appraisal.`
  );
}

/**
 * Whether a point estimate is fit to show at all.
 *
 * At 95% coverage the measured error is 151%, so the interval spans from
 * roughly 0.4x to unbounded. An interval that wide carries no information a
 * user can act on, and presenting it invites anchoring on the point estimate
 * inside it. Callers should prefer `flagged` over rendering one.
 */
export function isRangeInformative(range: CalibratedRange): boolean {
  return !range.highUnbounded;
}
