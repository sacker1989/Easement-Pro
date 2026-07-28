import { HAND_VERIFIED_PARCELS, type TestParcel } from './hand-verified-parcels';
import type { ParcelVendor, VendorParcelResult } from './vendor';

/**
 * Scores a vendor against the hand-verified parcel set.
 *
 * The scoring is deliberately unforgiving about identity and forgiving about
 * magnitude. A wrong parcel id is a wrong property and cannot be excused; a
 * lot area a few percent off is a digitisation difference between the vendor's
 * geometry and the county's, which is expected and harmless.
 */

/** Lot areas within this fraction are treated as agreeing. */
export const LOT_AREA_TOLERANCE = 0.02;
/** Assessed values within this fraction are treated as agreeing. */
export const VALUE_TOLERANCE = 0.01;

export type FieldOutcome = 'match' | 'mismatch' | 'not-returned' | 'no-ground-truth';

export interface ParcelScore {
  readonly ain: string;
  readonly stratum: TestParcel['stratum'];
  readonly returnedRecord: boolean;
  readonly parcelId: FieldOutcome;
  readonly lotArea: FieldOutcome;
  readonly landValue: FieldOutcome;
  readonly hasDocumentImage: boolean;
  readonly error: string | null;
}

export interface VendorScorecard {
  readonly vendorId: string;
  readonly displayName: string;
  readonly configured: boolean;
  readonly parcelsAttempted: number;
  /** Fraction of parcels for which the vendor returned any record at all. */
  readonly coverageRate: number;
  /** Of records returned, fraction whose parcel id matched ground truth. */
  readonly parcelIdAccuracy: number;
  readonly lotAreaAccuracy: number;
  readonly landValueAccuracy: number;
  /** Fraction of parcels for which a recorded-document image was available. */
  readonly documentImageRate: number;
  readonly errorCount: number;
  /** Per-stratum coverage, to expose where a vendor is weak. */
  readonly coverageByStratum: Readonly<Record<string, number>>;
  readonly scores: readonly ParcelScore[];
}

/** Compares identifiers ignoring the punctuation vendors disagree about. */
export function normalizeParcelId(id: string): string {
  return id.replace(/[^0-9a-z]/gi, '').toUpperCase();
}

function withinTolerance(actual: number, expected: number, tolerance: number): boolean {
  if (expected === 0) return actual === 0;
  return Math.abs(actual - expected) / Math.abs(expected) <= tolerance;
}

function scoreNumeric(
  actual: number | null,
  expected: number | null,
  tolerance: number,
): FieldOutcome {
  // Nothing to score against when the county publishes no value.
  if (expected === null) return 'no-ground-truth';
  if (actual === null || !Number.isFinite(actual)) return 'not-returned';
  return withinTolerance(actual, expected, tolerance) ? 'match' : 'mismatch';
}

function scoreParcel(parcel: TestParcel, result: VendorParcelResult | null, error: string | null): ParcelScore {
  if (error || !result) {
    return {
      ain: parcel.ain,
      stratum: parcel.stratum,
      returnedRecord: false,
      parcelId: 'not-returned',
      lotArea: 'not-returned',
      landValue: 'not-returned',
      hasDocumentImage: false,
      error,
    };
  }

  // Ground truth carries both AIN and APN; vendors use one or the other.
  const expectedIds = [normalizeParcelId(parcel.ain), normalizeParcelId(parcel.apn)];
  const parcelId: FieldOutcome =
    result.parcelId === null
      ? 'not-returned'
      : expectedIds.includes(normalizeParcelId(result.parcelId))
        ? 'match'
        : 'mismatch';

  return {
    ain: parcel.ain,
    stratum: parcel.stratum,
    returnedRecord: true,
    parcelId,
    lotArea: scoreNumeric(result.lotAreaSqFt, parcel.lotAreaSqFt, LOT_AREA_TOLERANCE),
    landValue: scoreNumeric(result.landValue, parcel.landValue, VALUE_TOLERANCE),
    hasDocumentImage: result.hasDocumentImage,
    error: null,
  };
}

const rate = (n: number, d: number) => (d === 0 ? 0 : n / d);

/** Accuracy over rows where ground truth actually exists for that field. */
function scoreableRate(scores: readonly ParcelScore[], field: 'lotArea' | 'landValue'): number {
  const scoreable = scores.filter((s) => s[field] !== 'no-ground-truth');
  return rate(scoreable.filter((s) => s[field] === 'match').length, scoreable.length);
}

/**
 * Runs a vendor over the test set. An unconfigured vendor yields a zeroed
 * scorecard with `configured: false` rather than throwing, so a comparison
 * run can include vendors that have no credentials yet.
 */
export async function scoreVendor(
  vendor: ParcelVendor,
  parcels: readonly TestParcel[] = HAND_VERIFIED_PARCELS,
): Promise<VendorScorecard> {
  const configured = vendor.isConfigured();
  const scores: ParcelScore[] = [];

  if (configured) {
    for (const parcel of parcels) {
      try {
        const result = await vendor.lookup({
          streetLine: parcel.streetLine,
          zip: parcel.zip,
          state: 'CA',
        });
        scores.push(scoreParcel(parcel, result, null));
      } catch (err) {
        scores.push(scoreParcel(parcel, null, err instanceof Error ? err.message : 'unknown error'));
      }
    }
  }

  const returned = scores.filter((s) => s.returnedRecord);
  const byStratum: Record<string, number> = {};
  for (const stratum of new Set(parcels.map((p) => p.stratum))) {
    const inStratum = scores.filter((s) => s.stratum === stratum);
    byStratum[stratum] = rate(inStratum.filter((s) => s.returnedRecord).length, inStratum.length);
  }

  return {
    vendorId: vendor.id,
    displayName: vendor.displayName,
    configured,
    parcelsAttempted: configured ? parcels.length : 0,
    coverageRate: rate(returned.length, scores.length),
    parcelIdAccuracy: rate(returned.filter((s) => s.parcelId === 'match').length, returned.length),
    // Denominators exclude rows with no ground truth: a vendor must not be
    // marked down for a field the county itself does not publish.
    lotAreaAccuracy: scoreableRate(returned, 'lotArea'),
    landValueAccuracy: scoreableRate(returned, 'landValue'),
    documentImageRate: rate(returned.filter((s) => s.hasDocumentImage).length, returned.length),
    errorCount: scores.filter((s) => s.error !== null).length,
    coverageByStratum: byStratum,
    scores,
  };
}

/** Renders scorecards as a plain-text table for side-by-side comparison. */
export function formatScorecards(cards: readonly VendorScorecard[]): string {
  const pct = (n: number) => (n * 100).toFixed(0).padStart(3) + '%';
  const lines = [
    'vendor        cfg  coverage  parcelId  lotArea  landValue  docImg  errors',
    '------------  ---  --------  --------  -------  ---------  ------  ------',
  ];
  for (const c of cards) {
    lines.push(
      c.displayName.padEnd(14) +
        (c.configured ? ' yes' : ' no ') +
        '  ' + pct(c.coverageRate) +
        '     ' + pct(c.parcelIdAccuracy) +
        '     ' + pct(c.lotAreaAccuracy) +
        '     ' + pct(c.landValueAccuracy) +
        '      ' + pct(c.documentImageRate) +
        '   ' + String(c.errorCount).padStart(5),
    );
  }
  const unconfigured = cards.filter((c) => !c.configured);
  if (unconfigured.length > 0) {
    lines.push('');
    lines.push(
      'Not evaluated (no credentials): ' + unconfigured.map((c) => c.displayName).join(', '),
    );
  }
  return lines.join('\n');
}
