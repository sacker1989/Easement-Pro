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

function isLaCountyZip(zip: string): boolean {
  const numericZip = Number(zip);
  return LA_COUNTY_ZIP_RANGES.some(([low, high]) => numericZip >= low && numericZip <= high);
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
    if (address.state === 'CA' && isLaCountyZip(address.zip)) {
      return 'Los Angeles';
    }
    return null;
  },
};
