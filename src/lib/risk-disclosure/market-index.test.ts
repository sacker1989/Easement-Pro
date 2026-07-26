import { describe, expect, it } from 'vitest';
import { LA_COUNTY_HPI_BY_YEAR, LA_COUNTY_HPI_LATEST_YEAR } from './la-county-hpi-data';
import type { AssessorParcelValuation } from './la-county-assessor-provider';
import {
  indexAssessedValue,
  marketAdjustParcel,
  MarketIndexError,
  parseBaseYear,
} from './market-index';

/** Small fixed series so assertions do not shift when the data is refreshed. */
const HPI = { 2000: 100, 2001: 110, 2006: 258, 2025: 416 } as const;

const PARCEL: AssessorParcelValuation = {
  ain: '2004001003',
  apn: '2004-001-003',
  situsFullAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  lotAreaSqFt: 10000,
  landValue: 500000,
  improvementValue: 100000,
  rollYear: '2026',
  landBaseYear: '2001',
  landValuePerSqFt: 50,
};

describe('parseBaseYear', () => {
  it('accepts a plausible year as a string', () => {
    expect(parseBaseYear('2001')).toBe(2001);
  });

  it('rejects years before Prop 13 established the earliest base year', () => {
    expect(parseBaseYear('1974')).toBeNull();
  });

  it('rejects blanks and non-numeric values', () => {
    expect(parseBaseYear(' ')).toBeNull();
    expect(parseBaseYear(null)).toBeNull();
    expect(parseBaseYear('n/a')).toBeNull();
  });
});

describe('indexAssessedValue', () => {
  it('scales a value forward by the ratio of the two index points', () => {
    const result = indexAssessedValue(100000, 2001, HPI, 2025);
    expect(result.indexRatio).toBeCloseTo(416 / 110, 6);
    expect(result.indexedValue).toBeCloseTo(100000 * (416 / 110), 4);
    expect(result.yearsStale).toBe(24);
  });

  it('leaves a value unchanged when base and target years match', () => {
    const result = indexAssessedValue(100000, 2025, HPI, 2025);
    expect(result.indexRatio).toBe(1);
    expect(result.indexedValue).toBe(100000);
  });

  it('throws rather than silently skipping when the base year has no index', () => {
    // Returning the stale figure unchanged would present it as current.
    expect(() => indexAssessedValue(100000, 1988, HPI, 2025)).toThrow(MarketIndexError);
  });

  it('rejects a non-positive assessed value', () => {
    expect(() => indexAssessedValue(0, 2001, HPI, 2025)).toThrow(MarketIndexError);
  });
});

describe('marketAdjustParcel', () => {
  it('produces a per-sq-ft value above the raw assessed rate', () => {
    const adjusted = marketAdjustParcel(PARCEL, PARCEL.landBaseYear, HPI, 2025);
    expect(adjusted).not.toBeNull();
    expect(adjusted!.marketLandValuePerSqFt).toBeGreaterThan(PARCEL.landValuePerSqFt);
    expect(adjusted!.marketLandValuePerSqFt).toBeCloseTo((500000 * (416 / 110)) / 10000, 6);
  });

  it('states the base year, the staleness, and the multiple applied', () => {
    const adjusted = marketAdjustParcel(PARCEL, '2001', HPI, 2025);
    expect(adjusted!.note).toContain('2001 base year');
    expect(adjusted!.note).toContain('24 years');
    expect(adjusted!.note).toContain('Proposition 13');
  });

  it('discloses that the result is modelled rather than appraised', () => {
    const adjusted = marketAdjustParcel(PARCEL, '2001', HPI, 2025);
    expect(adjusted!.note).toContain('not an appraisal');
  });

  it('returns null when the parcel carries no usable base year', () => {
    // Callers fall back to the raw figure and say so, rather than guessing.
    expect(marketAdjustParcel(PARCEL, null, HPI, 2025)).toBeNull();
    expect(marketAdjustParcel(PARCEL, ' ', HPI, 2025)).toBeNull();
  });

  it('returns null when the base year predates index coverage', () => {
    expect(marketAdjustParcel(PARCEL, '1979', HPI, 2025)).toBeNull();
  });
});

describe('bundled LA County HPI series', () => {
  it('covers the base years the assessor roll actually contains', () => {
    // Observed base years on one block spanned 2001-2022.
    for (const year of [2001, 2005, 2006, 2010, 2018, 2022]) {
      expect(LA_COUNTY_HPI_BY_YEAR[year]).toBeGreaterThan(0);
    }
  });

  it('rises over the long run, so old assessments index upward', () => {
    expect(LA_COUNTY_HPI_BY_YEAR[LA_COUNTY_HPI_LATEST_YEAR]!).toBeGreaterThan(
      LA_COUNTY_HPI_BY_YEAR[2001]!,
    );
  });

  it('lags the current year, which the caveat text must not contradict', () => {
    expect(LA_COUNTY_HPI_LATEST_YEAR).toBeLessThan(new Date().getFullYear() + 1);
  });
});
