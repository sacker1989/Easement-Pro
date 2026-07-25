import { getStateCompliance } from '@/config/state-tiers';
import { buildGeneralFallback } from '@/lib/document-retrieval/general-fallback';
import { LA_COUNTY_FALLBACK_DATA } from '@/lib/document-retrieval/la-county-fallback';
import { zipHeuristicCountyResolver, type CountyResolver } from './county-resolver';
import { normalizeAddress } from './normalize-address';
import { noOpParcelLookupProvider, type ParcelLookupProvider } from './parcel-lookup-provider';
import type { AddressInput, AddressResolutionResult } from './types';

export interface ResolveAddressOptions {
  countyResolver?: CountyResolver;
  parcelLookupProvider?: ParcelLookupProvider;
}

/**
 * Entry point for both LA County and future nationwide search: resolves any
 * US address to either a retrievable parcel document, LA County's hardcoded
 * fallback flow, or general nationwide fallback guidance routed to Track 3.
 *
 * Throws InvalidAddressError (from normalize-address.ts) for malformed input.
 */
export async function resolveAddress(
  input: AddressInput,
  options: ResolveAddressOptions = {},
): Promise<AddressResolutionResult> {
  const countyResolver = options.countyResolver ?? zipHeuristicCountyResolver;
  const parcelLookupProvider = options.parcelLookupProvider ?? noOpParcelLookupProvider;

  const normalized = normalizeAddress(input);
  const stateCompliance = getStateCompliance(normalized.state);
  const county = countyResolver.resolve(normalized);

  const parcel = await parcelLookupProvider.lookup(normalized);
  if (parcel) {
    return { kind: 'document-found', input, normalized, stateCompliance, parcel };
  }

  if (normalized.state === 'CA' && county === 'Los Angeles') {
    return {
      kind: 'la-county-fallback',
      input,
      normalized,
      stateCompliance,
      county: 'Los Angeles',
      reason:
        'No document vendor is connected yet for LA County records, so this routes ' +
        'to the Registrar-Recorder fallback reference data.',
      fallback: LA_COUNTY_FALLBACK_DATA,
    };
  }

  const { reason, guidance } = buildGeneralFallback(county, normalized.state);
  return {
    kind: 'general-fallback',
    input,
    normalized,
    stateCompliance,
    reason,
    guidance,
  };
}
