/**
 * Per-ZIP fitness gate for the land-share method.
 *
 * WHY: the back-test (docs/backtest-zip-land-share.md §7.2) found one ZIP where
 * the method fails outright. 93550 (Palmdale) carries a current-regime land
 * share of 0.386 against 0.700-0.814 everywhere else, because its share
 * distribution is bimodal — 373 parcels at exactly 0.250 and 194 at exactly
 * 0.700. Its share error is 44.9%, more than four times the pooled figure.
 *
 * The critical part: NOTHING in the parcel record predicts this. The two modes
 * were probed against price, building size, lot size, use code, base year and
 * AIN mapbook, and are distinguished by none of them — the sub-$0.35 and
 * ≥0.35 groups have the same median total ($463k vs $456k), the same sizes and
 * the same use codes. A ZIP-level median share is simply not a meaningful
 * statistic there, and the only way to know is to measure the dispersion at
 * runtime. That is what this module does. It is recommendation 4 of the report.
 *
 * A ZIP that fails this gate must degrade to `flagged` and emit NO figure,
 * matching the house rule in jurisdiction-valuation-bridge.ts that a number
 * with nothing behind it is not surfaced for the user to anchor on.
 */

/**
 * Share-IQR observed across the 15 ZIPs where the method behaved, from §7.2.
 * Recorded as evidence for the threshold, not used as one directly.
 */
export const SOUND_ZIP_IQR_RANGE = { min: 0.071, max: 0.185 } as const;

/** Share-IQR measured for the one ZIP that failed, 93550 Palmdale. */
export const FAILING_ZIP_IQR = 0.299;

/**
 * PROVISIONAL. Sits in the gap between the sound band (max 0.185) and the one
 * observed failure (0.299).
 *
 * FITTED ON 16 ZIPs — 15 sound, 1 failing. That is one failure, which is not
 * enough to locate a boundary. The report is explicit that this "must be
 * fitted on more ZIPs than the 16 here before it is hard-coded". Treat it as a
 * placeholder that is better than no gate, not as a calibrated constant, and
 * re-fit it before relying on it outside LA County.
 */
export const PROVISIONAL_IQR_THRESHOLD = 0.2;

/**
 * Minimum parcels in a ZIP's current-regime cohort before its median share is
 * trusted. The back-test's smallest cell was 183 and it required n>=30 per
 * cell; this floor is the lower of those, chosen so the gate is not itself the
 * binding constraint on coverage. Also provisional.
 */
export const MIN_COHORT_SIZE = 30;

export type ZipFitness =
  | {
      readonly status: 'sound';
      readonly iqr: number;
      readonly n: number;
      readonly medianShare: number;
    }
  | {
      readonly status: 'unfit';
      readonly iqr: number;
      readonly n: number;
      readonly medianShare: number;
      readonly reason: string;
    }
  | {
      readonly status: 'insufficient-data';
      readonly n: number;
      readonly reason: string;
    };

export class ZipFitnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipFitnessError';
  }
}

/**
 * Percentile by linear interpolation between order statistics (the "R type 7"
 * convention, which is also NumPy's default). Stated explicitly because
 * quartile conventions differ and the threshold above was fitted against IQRs
 * computed this way — a different convention shifts the numbers.
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new ZipFitnessError('Cannot take a percentile of an empty sample');
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Interquartile range of a sample of land shares. */
export function shareIqr(shares: readonly number[]): number {
  const sorted = [...shares].sort((a, b) => a - b);
  return percentile(sorted, 0.75) - percentile(sorted, 0.25);
}

/**
 * Decides whether a ZIP's current-regime share distribution is tight enough to
 * support a land-value estimate.
 *
 * `shares` must be the land shares of RECENTLY REASSESSED parcels only — the
 * current-regime cohort. Passing an all-vintage sample inflates the IQR via the
 * base-year drift measured in spec §3.1 and will fail sound ZIPs.
 */
export function assessZipFitness(
  shares: readonly number[],
  options: { iqrThreshold?: number; minCohortSize?: number } = {},
): ZipFitness {
  const { iqrThreshold = PROVISIONAL_IQR_THRESHOLD, minCohortSize = MIN_COHORT_SIZE } = options;

  const clean = shares.filter((s) => Number.isFinite(s) && s > 0 && s < 1);

  if (clean.length < minCohortSize) {
    return {
      status: 'insufficient-data',
      n: clean.length,
      reason:
        `Only ${clean.length} recently-reassessed parcels with a usable land share were found for ` +
        `this ZIP; at least ${minCohortSize} are required before a ZIP-level median is trusted. ` +
        `No land-value estimate is offered.`,
    };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const iqr = percentile(sorted, 0.75) - percentile(sorted, 0.25);
  const medianShare = percentile(sorted, 0.5);

  if (iqr > iqrThreshold) {
    return {
      status: 'unfit',
      iqr,
      n: clean.length,
      medianShare,
      reason:
        `The land/improvement split varies too widely across this ZIP for its median to be ` +
        `meaningful (interquartile range ${iqr.toFixed(3)}, above the ${iqrThreshold.toFixed(2)} ` +
        `limit; ZIPs where this method was validated ranged ` +
        `${SOUND_ZIP_IQR_RANGE.min}-${SOUND_ZIP_IQR_RANGE.max}). In the one measured case of this ` +
        `failure the resulting error was 44.9%, four times the typical figure. No land-value ` +
        `estimate is offered for this ZIP.`,
    };
  }

  return { status: 'sound', iqr, n: clean.length, medianShare };
}

/** Convenience: may a figure be emitted for this ZIP at all? */
export function mayEmitEstimate(fitness: ZipFitness): boolean {
  return fitness.status === 'sound';
}
