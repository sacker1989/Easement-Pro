export { InvalidAddressError, normalizeAddress } from './normalize-address';
export { zipHeuristicCountyResolver, type CountyResolver } from './county-resolver';
export { noOpParcelLookupProvider, type ParcelLookupProvider } from './parcel-lookup-provider';
export { resolveAddress, type ResolveAddressOptions } from './resolve-address';
export type {
  AddressInput,
  AddressResolutionResult,
  DocumentFoundResult,
  GeneralFallbackResult,
  LaCountyFallbackResult,
  NormalizedAddress,
  ParcelRecord,
} from './types';
