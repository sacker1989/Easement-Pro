/**
 * Reconciles the two land-value paths when a parcel supports both.
 *
 * PATH A — market-indexed assessment. Take the parcel's own assessed land
 * value and index it forward by the county house-price index from its
 * Proposition 13 vintage. Available in LA (published `Roll_LandBaseYear`) and
 * San Diego (vintage inferred from `DOCDATE`, see
 * docs/validation-sd-docdate.md). Parcel-specific.
 *
 * PATH B — ZIP comparables. ZIP median total value × ZIP current-regime land
 * share, per docs/backtest-zip-land-share.md §3.2. Available wherever a sound
 * ZIP cohort exists. ZIP-generic.
 *
 * MEASURED DISAGREEMENT. Both paths were computed for 27,770 LA County
 * residential parcels across 6 ZIPs and compared as the ratio A/B:
 *
 *   base-year bucket   p10    median   p90    within 1.5x
 *   pre-1990           0.66   1.23     1.93   60%
 *   1990s              0.71   1.26     1.97   57%
 *   2000s              0.62   1.27     1.91   57%
 *   2010s              0.50   1.09     1.60   68%
 *   2020-23            0.59   1.17     1.60   71%
 *
 * Three facts follow, and they drive every decision in this module.
 *
 * 1. The paths disagree materially. Only 57-71% of parcels fall within 1.5x of
 *    each other, and p10 to p90 spans roughly a factor of four.
 * 2. Path A runs systematically HIGHER — median ratio 1.09 to 1.27 in every
 *    bucket. The disagreement is a bias, not noise around parity.
 * 3. The bias is ZIP-dependent. 90045 ran 1.36-1.64 while 91331 ran 0.85-1.07,
 *    so no single global correction fixes it.
 *
 * WHY THIS MODULE DOES NOT AVERAGE THE TWO. Averaging is the obvious move and
 * it is wrong here. Neither path is ground truth: Path B's error was measured
 * at 19.3% median APE against assessed land value, and Path A's error has
 * never been measured at all — it cannot be, because indexing from a *fresh*
 * base year is nearly a no-op, so on the only parcels where ground truth
 * exists Path A scores ~0% by construction. That is the same degeneracy the
 * back-test identified for its naive baseline. With one path unmeasurable and
 * a 1.2x systematic gap between them, a midpoint is a number neither method
 * supports and no evidence prefers.
 *
 * So: agreement is treated as corroboration, and disagreement is reported as
 * disagreement.
 */

import { calibratedRange, type CalibratedRange, type CoverageLevel } from './calibrated-range';

/**
 * Ratio band within which the two paths are treated as corroborating.
 *
 * Set at 1.5x because that is the band the measurement above reports against —
 * 57-71% of parcels fall inside it. It is a MEASURED reference point, not a
 * tolerance chosen for a desired pass rate, and it should be re-derived if the
 * comparison is re-run on more counties.
 */
export const CONCORDANCE_RATIO = 1.5;

/** Median A/B ratio by Prop 13 base-year decade, from the measurement above. */
export const MEASURED_AB_RATIO_BY_VINTAGE: Readonly<Record<string, number>> = {
  'pre-1990': 1.23,
  '1990s': 1.26,
  '2000s': 1.27,
  '2010s': 1.09,
  '2020-23': 1.17,
};

/**
 * Share of LA parcels observed within CONCORDANCE_RATIO, by the same buckets.
 * Note the trend: agreement IMPROVES for recent vintages, because indexing
 * from a recent base year is nearly a no-op and both paths then approximate
 * the same fresh-market quantity.
 */
export const MEASURED_CONCORDANCE_RATE: Readonly<Record<string, number>> = {
  'pre-1990': 0.6,
  '1990s': 0.57,
  '2000s': 0.57,
  '2010s': 0.68,
  '2020-23': 0.71,
};

/**
 * The same measurement repeated in San Diego: 44,456 parcels with a usable
 * DOCDATE vintage across 6 ZIPs.
 *
 * San Diego agrees WORSE — 45% overall against roughly 60% in LA — and the
 * trend is INVERTED: agreement degrades toward recent vintages (55% -> 40%)
 * where LA's improves (57% -> 71%). p10 falls to 0.24 in the newest bucket,
 * meaning one parcel in ten has Path A below a quarter of Path B.
 *
 * That inversion is diagnostic, and it qualifies the DOCDATE validation. A
 * recent full-transfer DOCDATE should make Path A a near no-op, exactly as a
 * recent base year does in LA, so agreement should be at its best there. It is
 * at its worst. The reading: DOCDATE is a strong AGGREGATE signal — the 2.18x
 * gradient across vintage buckets in docs/validation-sd-docdate.md is real and
 * reproduced — but a WEAK PARCEL-LEVEL one. That validation compared medians
 * by bucket, which averages away exactly the per-parcel dispersion this
 * measurement exposes.
 *
 * Practical consequence: more San Diego parcels fall out as `discordant`, and
 * that is the correct behaviour rather than a threshold problem. Do not widen
 * CONCORDANCE_RATIO to raise the pass rate.
 */
export const MEASURED_CONCORDANCE_RATE_SAN_DIEGO: Readonly<Record<string, number>> = {
  'pre-1990': 0.55,
  '1990s': 0.6,
  '2000s': 0.51,
  '2010s': 0.47,
  '2020-23': 0.4,
};

/** Median A/B ratio by vintage decade in San Diego. */
export const MEASURED_AB_RATIO_SAN_DIEGO: Readonly<Record<string, number>> = {
  'pre-1990': 1.35,
  '1990s': 1.25,
  '2000s': 1.16,
  '2010s': 1.16,
  '2020-23': 1.1,
};

/**
 * Share of San Diego parcels whose DOCDATE vintage passes the four conditions
 * in san-diego-assessor-provider.ts, so Path A is available at all: 44,456 of
 * 74,743 sampled. The other 40% reach reconciliation as single-path or
 * unavailable.
 */
export const SAN_DIEGO_USABLE_VINTAGE_RATE = 0.595;

export interface PathEstimate {
  /** Land value in dollars. */
  readonly landValue: number;
  /** Short provenance string for the report. */
  readonly source: string;
}

export type ReconciliationStatus =
  /** Both paths available and within CONCORDANCE_RATIO of each other. */
  | 'concordant'
  /** Both available and outside that band. Reported as disagreement. */
  | 'discordant'
  /** Only one path available. */
  | 'single-path'
  /** Neither available. */
  | 'unavailable';

export interface Reconciliation {
  readonly status: ReconciliationStatus;
  readonly pathA: PathEstimate | null;
  readonly pathB: PathEstimate | null;
  /** A/B ratio when both are present. */
  readonly ratio: number | null;
  /**
   * Low and high bounds in dollars. Null when nothing can be reported.
   *
   * `high` may be null where the underlying calibration is unbounded — at 95%
   * coverage the measured error exceeds 100%, so no finite upper bound exists.
   */
  readonly low: number | null;
  readonly high: number | null;
  /**
   * A single figure to lead with, or null. Deliberately null whenever the
   * paths disagree: presenting one number there would assert a resolution the
   * evidence does not support.
   */
  readonly pointEstimate: number | null;
  /** Confidence in the app-wide vocabulary. */
  readonly confidence: 'verified' | 'inferred' | 'flagged';
  readonly explanation: string;
}

function span(a: number, b: number): { low: number; high: number } {
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

/**
 * Reconciles the paths. Pass null for a path the parcel does not support.
 *
 * `coverage` selects which calibrated interval widens a single-path or
 * concordant result. It has no effect on a discordant one, whose bounds come
 * from the two estimates themselves.
 */
export function reconcilePaths(
  pathA: PathEstimate | null,
  pathB: PathEstimate | null,
  coverage: CoverageLevel = 90,
): Reconciliation {
  if (pathA === null && pathB === null) {
    return {
      status: 'unavailable',
      pathA: null,
      pathB: null,
      ratio: null,
      low: null,
      high: null,
      pointEstimate: null,
      confidence: 'flagged',
      explanation:
        'No land-value estimate could be produced for this parcel. The county publishes no ' +
        'usable assessed value with a reliable assessment vintage, and no sound ZIP comparable ' +
        'cohort was available. Request official assessor records before relying on any figure.',
    };
  }

  // --- single path -------------------------------------------------------
  if (pathA === null || pathB === null) {
    const only = (pathA ?? pathB)!;
    const range: CalibratedRange = calibratedRange(only.landValue, coverage);
    return {
      status: 'single-path',
      pathA,
      pathB,
      ratio: null,
      low: range.low,
      high: range.high,
      pointEstimate: only.landValue,
      confidence: 'inferred',
      explanation:
        `Only one valuation method was available for this parcel (${only.source}). There is no ` +
        'second, independent estimate to corroborate it, so the range reflects that method\'s ' +
        'own measured error and nothing more.',
    };
  }

  // --- both paths --------------------------------------------------------
  const ratio = pathA.landValue / pathB.landValue;
  const withinBand = ratio <= CONCORDANCE_RATIO && ratio >= 1 / CONCORDANCE_RATIO;
  const bounds = span(pathA.landValue, pathB.landValue);

  if (withinBand) {
    // Corroboration: two methods with different failure modes agreeing.
    // Path A is parcel-specific and Path B is ZIP-generic, so their errors are
    // not the same error twice.
    const mid = (pathA.landValue + pathB.landValue) / 2;
    const range = calibratedRange(mid, coverage);
    return {
      status: 'concordant',
      pathA,
      pathB,
      ratio,
      low: Math.min(range.low, bounds.low),
      high: range.high === null ? null : Math.max(range.high, bounds.high),
      pointEstimate: mid,
      confidence: 'inferred',
      explanation:
        `Two independent methods agree within ${CONCORDANCE_RATIO}x on this parcel ` +
        `(${pathA.source} and ${pathB.source}, ratio ${ratio.toFixed(2)}). They fail in ` +
        'different ways — one uses this parcel\'s own assessed value, the other its ' +
        'neighbourhood — so agreement is genuine corroboration rather than the same error ' +
        'twice. Between 57% and 71% of parcels agree this closely, depending on assessment ' +
        'vintage. The figure remains a screening estimate, not an appraisal.',
    };
  }

  // Disagreement. Report it as disagreement: bounds span both estimates, no
  // point estimate, confidence flagged. Not averaged — see the module header.
  return {
    status: 'discordant',
    pathA,
    pathB,
    ratio,
    low: bounds.low,
    high: bounds.high,
    pointEstimate: null,
    confidence: 'flagged',
    explanation:
      `Two independent methods disagree by ${ratio >= 1 ? ratio.toFixed(2) : (1 / ratio).toFixed(2)}x ` +
      `on this parcel: ${pathA.source} gives ${Math.round(pathA.landValue).toLocaleString()} and ` +
      `${pathB.source} gives ${Math.round(pathB.landValue).toLocaleString()}. No single figure is ` +
      'offered, because neither method is known to be correct where they conflict — the ' +
      'ZIP-comparable method carries a measured 19.3% median error, and the market-indexed ' +
      'method has never been measured, since it cannot be tested on the recently reassessed ' +
      'parcels that are the only available ground truth. The bounds shown span both estimates. ' +
      'Obtain an appraisal or official assessor records before relying on a figure for this parcel.',
  };
}

/**
 * Whether a reconciliation may be shown as a single headline number.
 *
 * False for every discordant result. A caller that needs one number for a
 * letter or a checkout total must treat this as a hard gate rather than
 * reaching for `low`, `high`, or their midpoint.
 */
export function hasReportablePointEstimate(r: Reconciliation): boolean {
  return r.pointEstimate !== null;
}
