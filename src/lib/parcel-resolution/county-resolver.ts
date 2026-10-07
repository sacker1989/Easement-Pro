import type { NormalizedAddress } from './types';

export interface CountyResolver {
  resolve(address: NormalizedAddress): string | null;
}

/**
 * Approximate LA County ZIP ranges, used only as an MVP placeholder so the
 * fallback-routing logic is testable without a live geocoding/vendor
 * dependency. Not authoritative — some ranges overlap neighboring counties
 * (e.g. parts of Ventura County share the 913xx prefix). Phase 2 replaces
 * this with real parcel/GIS vendor data (ATTOM, Regrid, etc.).
 */
const LA_COUNTY_ZIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [90001, 90899], // Los Angeles basin, South Bay, Long Beach area
  [91001, 91899], // San Gabriel Valley
  [91301, 91499], // Conejo Valley / western San Fernando Valley
  [93510, 93591], // Antelope Valley
];

/**
 * Orange County ranges, added so the two counties with working live providers
 * are reachable at all. Before this the heuristic knew only LA, so Anaheim
 * resolved to null and `/report` reported "no provider built for this county"
 * for a county whose provider works.
 *
 * ORDER MATTERS BELOW. The 906xx and 907xx entries are Orange County enclaves
 * that sit INSIDE the LA range 90001-90899 above — Buena Park, Cypress, La
 * Palma, Los Alamitos, Seal Beach. Orange and San Diego are therefore tested
 * first, and a broad LA range no longer swallows them.
 */
const ORANGE_COUNTY_ZIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [90620, 90633], // Buena Park, Cypress, La Palma
  [90720, 90743], // Los Alamitos, Rossmoor, Seal Beach
  [92602, 92899], // Irvine, Santa Ana, Anaheim, Costa Mesa, and the county body
];

/** San Diego County ranges. No overlap with the LA ranges: 91899 < 91901. */
const SAN_DIEGO_ZIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [91901, 91987], // Alpine, Chula Vista, Bonita, Jamul
  [92003, 92199], // San Diego city, North County, East County
];

/** Cook County, Illinois. Approximate, like the California ranges above. */
const COOK_COUNTY_ZIP_RANGES: ReadonlyArray<readonly [number, number]> = [
  [60004, 60025],
  [60053, 60078],
  [60090, 60107],
  [60130, 60163],
  [60171, 60209],
  [60301, 60305],
  [60401, 60480],
  [60601, 60707],
  [60803, 60827],
];

function inRanges(zip: string, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  const numericZip = Number(zip);
  return ranges.some(([low, high]) => numericZip >= low && numericZip <= high);
}

function isLaCountyZip(zip: string): boolean {
  return inRanges(zip, LA_COUNTY_ZIP_RANGES);
}

/**
 * Default county resolver: prefers an explicit county passed on the input
 * (e.g. from a future geocoder), and otherwise falls back to the ZIP
 * heuristic above, scoped to California ZIP codes only.
 */
export const zipHeuristicCountyResolver: CountyResolver = {
  resolve(address) {
    if (address.county) {
      return address.county;
    }
    /*
     * ILLINOIS, ADDED 2026-10-07 WITH COOK COUNTY. The first non-California
     * branch, and the ranges are approximate for the same reason the
     * California ones are: this is a ZIP heuristic standing in for a geocoder,
     * not an authoritative boundary.
     *
     * Cook is unusually tractable — Chicago's 606xx block sits almost entirely
     * inside the county, and the suburban bands cover most of the rest. It
     * misses collar-county edges, which resolve to null and get the
     * national-benchmark path rather than a neighbouring county's figures.
     */
    if (address.state === 'IL') {
      return inRanges(address.zip, COOK_COUNTY_ZIP_RANGES) ? 'Cook' : null;
    }
    if (address.state !== 'CA') return null;
    // Orange and San Diego before LA: both carry ranges that sit inside the
    // broader LA bands, and testing LA first would claim them.
    if (inRanges(address.zip, ORANGE_COUNTY_ZIP_RANGES)) return 'Orange';
    if (inRanges(address.zip, SAN_DIEGO_ZIP_RANGES)) return 'San Diego';
    if (isLaCountyZip(address.zip)) return 'Los Angeles';
    return null;
  },
};
