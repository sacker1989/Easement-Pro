import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import type { GeneralGuidance, LaCountyFallbackData } from '@/lib/document-retrieval/types';

export interface AddressInput {
  street: string;
  city: string;
  /** Two-letter USPS state code. Case-insensitive; normalized on resolution. */
  state: string;
  zip: string;
  /**
   * Optional — pass this when the county is already known (e.g. from a future
   * geocoder/vendor). When omitted, resolution falls back to a ZIP heuristic.
   */
  county?: string;
}

export interface NormalizedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  zipPlus4: string | null;
  county?: string;
}

export interface ParcelRecord {
  apn: string;
  county: string;
  state: string;
  /** Name of the provider that produced this record, for provenance/audit purposes. */
  source: string;
}

interface BaseResolutionResult {
  input: AddressInput;
  normalized: NormalizedAddress;
  stateCompliance: StateComplianceEntry;
}

export interface DocumentFoundResult extends BaseResolutionResult {
  kind: 'document-found';
  parcel: ParcelRecord;
}

export interface LaCountyFallbackResult extends BaseResolutionResult {
  kind: 'la-county-fallback';
  county: 'Los Angeles';
  reason: string;
  fallback: LaCountyFallbackData;
}

export interface GeneralFallbackResult extends BaseResolutionResult {
  kind: 'general-fallback';
  reason: string;
  guidance: GeneralGuidance;
}

export type AddressResolutionResult =
  | DocumentFoundResult
  | LaCountyFallbackResult
  | GeneralFallbackResult;
