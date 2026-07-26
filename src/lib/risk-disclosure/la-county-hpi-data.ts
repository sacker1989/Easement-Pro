/**
 * LA County house-price index, for restating a stale assessed value in
 * present-day terms.
 *
 * WHY THIS EXISTS: California's Proposition 13 caps assessment growth at 2%
 * per year until a property changes hands, so a parcel assessed value
 * reflects its last reassessment, not the market. Observed on a single block
 * of Faust Ave (2026 roll): land values ranged from USD 255,187 to USD
 * 740,440 across comparable lots, driven almost entirely by base years
 * spanning 2001-2022. Pricing an easement off the raw assessed value
 * understates long-held parcels severely and unevenly.
 *
 * SOURCE: FHFA House Price Index, annual census-tract series
 * (https://www.fhfa.gov/hpi/download/annual/hpi_at_tract.csv), filtered to
 * LA County tracts (FIPS 06037) and reduced to a per-year median across
 * roughly 1,660 tracts. Retrieved 2026-07-26. Base 2000 = 100.
 *
 * THIS IS NOT FHFA'S OFFICIAL COUNTY INDEX. FHFA publishes one, but only as
 * XLSX; this is a median-of-tracts composite derived from their tract data.
 * It is a reasonable approximation for a county-wide adjustment and must not
 * be cited as the official FHFA county figure.
 *
 * NOT REAL TIME. The series is annual and the latest year available is 2025.
 * No free, public, real-time house-price API exists; live transaction data
 * requires a licensed MLS feed or a commercial vendor.
 */

export const LA_COUNTY_HPI_BASE_YEAR = 2000;

/** Median FHFA tract HPI for LA County, by year. Base 2000 = 100. */
export const LA_COUNTY_HPI_BY_YEAR: Readonly<Record<number, number>> = {
  1977: 26.4,
  1978: 31.13,
  1979: 36.04,
  1980: 42.17,
  1981: 45.63,
  1982: 39.51,
  1983: 47.93,
  1984: 49.75,
  1985: 52.3,
  1986: 55.73,
  1987: 61.37,
  1988: 75.01,
  1989: 94.48,
  1990: 99.08,
  1991: 96.94,
  1992: 95.17,
  1993: 89.14,
  1994: 82.93,
  1995: 79.19,
  1996: 78.29,
  1997: 78.92,
  1998: 86.37,
  1999: 91.59,
  2000: 100,
  2001: 109.48,
  2002: 123.75,
  2003: 140.11,
  2004: 175.43,
  2005: 223.04,
  2006: 258.19,
  2007: 254.52,
  2008: 211.47,
  2009: 174.22,
  2010: 173.5,
  2011: 166.34,
  2012: 164.65,
  2013: 183.08,
  2014: 210.39,
  2015: 223.28,
  2016: 241.43,
  2017: 258.25,
  2018: 276.84,
  2019: 288.22,
  2020: 297.83,
  2021: 329.74,
  2022: 377.15,
  2023: 384.75,
  2024: 411.15,
  2025: 416.54,
};

export const LA_COUNTY_HPI_LATEST_YEAR = 2025;
