import {
  LA_COUNTY_HPI_BY_YEAR,
  LA_COUNTY_HPI_LATEST_YEAR,
} from './la-county-hpi-data';
import type { AssessorParcelValuation } from './la-county-assessor-provider';

/**
 * Restates a Prop 13-frozen assessed value in present-day terms by indexing
 * it forward with the local house-price index.
 *
 *   market ≈ assessed × (HPI_latest / HPI_baseYear)
 *
 * This is a modelled estimate, not an appraisal and not a market observation.
 * It assumes the parcel appreciated in line with the county median, which is
 * false for any individual property to some unknown degree. Treat the output
 * as an order-of-magnitude correction to a figure that is otherwise known to
 * be wrong, not as a valuation.
 */

export interface MarketIndexedValue {
  /** The raw assessed figure, unchanged. */
  readonly assessedValue: number;
  /** Assessment base year the assessed figure reflects. */
  readonly baseYear: number;
  /** HPI year the estimate is expressed in. */
  readonly indexedToYear: number;
  /** HPI_latest / HPI_baseYear. */
  readonly indexRatio: number;
  readonly indexedValue: number;
  /** Years between the base year and the index year. */
  readonly yearsStale: number;
}

export class MarketIndexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarketIndexError';
  }
}

/** Parses the county's string base-year field. Returns null when unusable. */
export function parseBaseYear(raw: unknown): number | null {
  const year = Number(String(raw ?? '').trim());
  if (!Number.isInteger(year)) return null;
  // Prop 13 established 1975 as the earliest possible base year.
  if (year < 1975 || year > LA_COUNTY_HPI_LATEST_YEAR + 1) return null;
  return year;
}

/**
 * Indexes an assessed value forward from its base year to the latest year in
 * the series. Throws when the base year has no index coverage — silently
 * skipping the adjustment would present a stale figure as current.
 */
export function indexAssessedValue(
  assessedValue: number,
  baseYear: number,
  hpiByYear: Readonly<Record<number, number>> = LA_COUNTY_HPI_BY_YEAR,
  targetYear: number = LA_COUNTY_HPI_LATEST_YEAR,
): MarketIndexedValue {
  if (!Number.isFinite(assessedValue) || assessedValue <= 0) {
    throw new MarketIndexError('Assessed value must be a positive number');
  }

  const fromIndex = hpiByYear[baseYear];
  const toIndex = hpiByYear[targetYear];

  if (fromIndex === undefined) {
    throw new MarketIndexError(`No house-price index available for base year ${baseYear}`);
  }
  if (toIndex === undefined) {
    throw new MarketIndexError(`No house-price index available for target year ${targetYear}`);
  }
  if (fromIndex <= 0) {
    throw new MarketIndexError(`House-price index for ${baseYear} is not positive`);
  }

  const indexRatio = toIndex / fromIndex;

  return {
    assessedValue,
    baseYear,
    indexedToYear: targetYear,
    indexRatio,
    indexedValue: assessedValue * indexRatio,
    yearsStale: targetYear - baseYear,
  };
}

export interface MarketAdjustedParcel {
  /** Land value per sq ft after indexing forward. */
  readonly marketLandValuePerSqFt: number;
  readonly indexed: MarketIndexedValue;
  /** Human-readable provenance and limits, for the methodology text. */
  readonly note: string;
}

/**
 * Applies the index to a parcel's land value. Returns null when the record
 * carries no usable base year, in which case callers should fall back to the
 * raw assessed value and say so rather than guessing at an adjustment.
 */
export function marketAdjustParcel(
  valuation: AssessorParcelValuation,
  rawBaseYear: unknown,
  hpiByYear: Readonly<Record<number, number>> = LA_COUNTY_HPI_BY_YEAR,
  targetYear: number = LA_COUNTY_HPI_LATEST_YEAR,
): MarketAdjustedParcel | null {
  const baseYear = parseBaseYear(rawBaseYear);
  if (baseYear === null) return null;

  let indexed: MarketIndexedValue;
  try {
    indexed = indexAssessedValue(valuation.landValue, baseYear, hpiByYear, targetYear);
  } catch {
    return null;
  }

  const multiple = indexed.indexRatio.toFixed(2);
  const note =
    `Assessed land value reflects a ${baseYear} base year, ${indexed.yearsStale} years ` +
    `before the ${targetYear} index. Under Proposition 13 the assessment does not track ` +
    `the market, so it has been indexed forward by the LA County house-price index ` +
    `(${multiple}x). This is a modelled adjustment assuming county-median appreciation, ` +
    `not an appraisal or an observed sale price.`;

  return {
    marketLandValuePerSqFt: indexed.indexedValue / valuation.lotAreaSqFt,
    indexed,
    note,
  };
}
