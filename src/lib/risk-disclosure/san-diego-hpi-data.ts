/**
 * San Diego County house-price index, for restating a Prop 13-frozen
 * assessment in present-day terms.
 *
 * WHY THIS EXISTS: same reason as la-county-hpi-data.ts. California's
 * Proposition 13 caps assessment growth at 2% per year until a property
 * changes hands, so an assessed value reflects its last reassessment rather
 * than the market. Measured across 97,026 San Diego parcels, assessed value
 * per living square foot runs 2.18x higher for parcels last conveyed in 2024
 * than for those last conveyed in 1990, with housing-stock age held flat —
 * see docs/validation-sd-docdate.md.
 *
 * SOURCE: FHFA House Price Index, annual census-tract series
 * (https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv), filtered to San
 * Diego County tracts (FIPS 06073) and reduced to a per-year median across
 * tracts, using the file's `hpi1990` column. Retrieved 2026-07-30.
 * Base 1990 = 100.
 *
 * NOTE THE DIFFERENT BASE YEAR. la-county-hpi-data.ts is base 2000 = 100 and
 * this is base 1990 = 100. Only ratios between years are ever used, so the
 * bases need not agree — but the two series must never be mixed in one
 * calculation or compared as levels.
 *
 * THIS IS NOT FHFA'S OFFICIAL COUNTY INDEX. It is a median-of-tracts composite
 * derived from their tract data, matching the method used for LA County. It is
 * a reasonable approximation for a county-wide adjustment and must not be
 * cited as the official FHFA county figure.
 *
 * NOT REAL TIME. The series is annual and the latest year available is 2025.
 */

export const SAN_DIEGO_HPI_BASE_YEAR = 1990;
export const SAN_DIEGO_HPI_LATEST_YEAR = 2025;

/** Median FHFA tract HPI for San Diego County, by year. Base 1990 = 100. */
export const SAN_DIEGO_HPI_BY_YEAR: Readonly<Record<number, number>> = {
  1975: 19.28, 1976: 25.34, 1977: 31.39, 1978: 38.68, 1979: 46.53,
  1980: 51.12, 1981: 54.92, 1982: 48.71, 1983: 55.5, 1984: 57.42,
  1985: 59.94, 1986: 63.23, 1987: 67.92, 1988: 76.77, 1989: 94.0,
  1990: 100.0, 1991: 99.47, 1992: 98.11, 1993: 94.2, 1994: 90.86,
  1995: 89.79, 1996: 89.72, 1997: 92.03, 1998: 101.11, 1999: 109.28,
  2000: 129.07, 2001: 144.46, 2002: 164.99, 2003: 184.83, 2004: 225.51,
  2005: 271.1, 2006: 278.26, 2007: 263.03, 2008: 223.92, 2009: 193.36,
  2010: 195.17, 2011: 185.19, 2012: 186.5, 2013: 209.2, 2014: 236.75,
  2015: 246.83, 2016: 266.08, 2017: 284.22, 2018: 300.66, 2019: 310.2,
  2020: 320.51, 2021: 357.28, 2022: 428.29, 2023: 454.54, 2024: 484.67,
  2025: 493.05,
};

/**
 * Tracts contributing to each year's median.
 *
 * Published because the coverage is NOT uniform and the thin years are exactly
 * the ones a Prop 13 base year is most likely to land in. 1975 rests on a
 * SINGLE tract; 1975-1985 range from 1 to 129 against roughly 415 mid-series.
 * A median over one tract is not a county index, and indexing a 1975-vintage
 * assessment off it would be arithmetic dressed up as measurement.
 *
 * The recent tail is also thinner (2022-2025 run 262-345), which is a property
 * of FHFA's data rather than an artefact — verified by re-running the
 * extraction against the complete 89.9 MB download.
 */
export const SAN_DIEGO_HPI_TRACT_COUNT_BY_YEAR: Readonly<Record<number, number>> = {
  1975: 1, 1976: 9, 1977: 32, 1978: 64, 1979: 99,
  1980: 83, 1981: 39, 1982: 48, 1983: 86, 1984: 96,
  1985: 129, 1986: 335, 1987: 362, 1988: 368, 1989: 395,
  1990: 416, 1991: 416, 1992: 416, 1993: 416, 1994: 416,
  1995: 415, 1996: 416, 1997: 416, 1998: 416, 1999: 416,
  2000: 414, 2001: 416, 2002: 416, 2003: 416, 2004: 415,
  2005: 415, 2006: 412, 2007: 415, 2008: 415, 2009: 415,
  2010: 414, 2011: 415, 2012: 416, 2013: 411, 2014: 394,
  2015: 401, 2016: 402, 2017: 399, 2018: 382, 2019: 402,
  2020: 416, 2021: 415, 2022: 345, 2023: 276, 2024: 277,
  2025: 262,
};

/**
 * Minimum tracts before a year's median is treated as a county index.
 * Set at 250 so the whole 1986-2025 span qualifies and the sparse 1975-1985
 * years do not. Chosen from the observed distribution — there is a clean gap
 * between 129 (1985) and 335 (1986) — not fitted to any outcome.
 */
export const MIN_RELIABLE_TRACT_COUNT = 250;

/** First year whose median rests on enough tracts to be usable. */
export const SAN_DIEGO_HPI_FIRST_RELIABLE_YEAR = 1986;

/** Whether a year's index is backed by enough tracts to index against. */
export function isReliableHpiYear(year: number): boolean {
  const n = SAN_DIEGO_HPI_TRACT_COUNT_BY_YEAR[year];
  return n !== undefined && n >= MIN_RELIABLE_TRACT_COUNT;
}
