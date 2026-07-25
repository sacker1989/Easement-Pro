import type { NormalizedAddress, ParcelRecord } from './types';

export interface ParcelLookupProvider {
  name: string;
  lookup(address: NormalizedAddress): Promise<ParcelRecord | null>;
}

/**
 * Default provider for Phase 1 MVP. No live vendor (DataTree, ATTOM, Regrid,
 * Cotality) is wired up yet — full vendor evaluation is Phase 2 scope. This
 * always returns null, so every address currently routes through a fallback
 * flow. A real provider can replace this without touching resolveAddress's
 * routing logic.
 */
export const noOpParcelLookupProvider: ParcelLookupProvider = {
  name: 'none',
  async lookup() {
    return null;
  },
};
