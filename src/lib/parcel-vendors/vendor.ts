/**
 * Vendor-agnostic parcel lookup, for evaluating candidates against each other.
 *
 * Phase 2 calls for piloting First American DataTree, ATTOM, Cotality and
 * Regrid against a hand-verified test set. They have incompatible APIs, so the
 * comparison only means something if each is reduced to the same shape first.
 * That is what this interface is for — the scoring harness never sees a
 * vendor-specific response.
 */

export type VendorId = 'datatree' | 'attom' | 'cotality' | 'regrid';

/** The subset of a parcel record the harness scores. */
export interface VendorParcelResult {
  /** County assessor parcel identifier, however the vendor spells it. */
  readonly parcelId: string | null;
  readonly lotAreaSqFt: number | null;
  readonly landValue: number | null;
  readonly improvementValue: number | null;
  /** Assessment vintage, when the vendor exposes one. */
  readonly rollYear: string | null;
  /** True when the vendor supplies a recorded-document image, not just an index entry. */
  readonly hasDocumentImage: boolean;
  /** Untouched vendor payload, for debugging a scoring miss. */
  readonly raw?: unknown;
}

export interface VendorLookupInput {
  readonly streetLine: string;
  readonly zip: string;
  readonly state: string;
}

export class VendorNotConfiguredError extends Error {
  constructor(vendor: VendorId) {
    super(
      `No credentials configured for "${vendor}". Set the corresponding API key ` +
        'in .env.local to enable live evaluation.',
    );
    this.name = 'VendorNotConfiguredError';
  }
}

export interface ParcelVendor {
  readonly id: VendorId;
  readonly displayName: string;
  /** False until credentials are present; the harness reports rather than throws. */
  isConfigured(): boolean;
  /** Returns null when the vendor has no record for the address. */
  lookup(input: VendorLookupInput): Promise<VendorParcelResult | null>;
}
