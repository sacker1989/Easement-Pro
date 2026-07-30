/**
 * Easement taxonomy.
 *
 * Per docs/spec-easement-valuation.md §5. Each variant carries what valuation
 * needs — encumbered area, term, exclusivity — rather than being a bare label,
 * because the valuation is per-area and per-rights-taken, not per-easement.
 */

export type EasementType =
  /** Transmission or distribution line, poles. Build restriction under the span. */
  | 'utility-overhead'
  /** Electric or telecom conduit. Minimal surface impact, no structures. */
  | 'utility-underground'
  /** Gravity or force main. No structures; access for excavation. */
  | 'sewer'
  /** Pipe or open channel. An open channel is near-total loss of the strip. */
  | 'storm-drain'
  | 'water-line'
  /** Gas or petroleum products. Often exclusive, wide corridor. */
  | 'pipeline'
  /** Shared driveway or landlocked-parcel access. Near-total loss on the strip. */
  | 'access-ingress-egress'
  /** Dedicated road, sidewalk, alley. Total loss. */
  | 'public-right-of-way'
  | 'drainage'
  /** Cut/fill support on graded lots. No structures, no regrading. */
  | 'slope'
  /** Perpetual development restriction; can affect the whole parcel. */
  | 'conservation'
  /** Established by use rather than grant. Unresolved until adjudicated. */
  | 'prescriptive';

export const EASEMENT_TYPES: readonly EasementType[] = [
  'utility-overhead',
  'utility-underground',
  'sewer',
  'storm-drain',
  'water-line',
  'pipeline',
  'access-ingress-egress',
  'public-right-of-way',
  'drainage',
  'slope',
  'conservation',
  'prescriptive',
] as const;

/**
 * Where knowledge of this easement came from.
 *
 * This matters as much as the geometry. An easement read off a recorded deed
 * and one a user ticked in a form must not produce identically-confident
 * figures, so this maps onto the existing three-state confidence vocabulary in
 * jurisdiction-valuation-bridge.ts rather than introducing a fourth scheme.
 */
export type EasementProvenance =
  /** Read from a recorded instrument. */
  | { readonly kind: 'recorded-document'; readonly instrumentNo: string; readonly recordedOn?: string }
  /** Shown on a recorded plat or subdivision map. */
  | { readonly kind: 'plat-map'; readonly mapRef: string }
  /** Inferred from a county GIS layer. Not a recorded instrument. */
  | { readonly kind: 'county-gis'; readonly layer: string; readonly queriedOn: string }
  /**
   * Proximity to infrastructure, per the 500 ft scan. Proximity is NOT an
   * easement — see docs/spec-proximity-easement-scan.md §2. Must never drive a
   * confident valuation on its own.
   */
  | { readonly kind: 'proximity-inference'; readonly distanceFt: number; readonly layer: string }
  /** The user said so. Unverified. */
  | { readonly kind: 'user-asserted' };

export interface ParcelEasement {
  readonly type: EasementType;
  /** Encumbered area in sq ft. Required — valuation is per-area. */
  readonly areaSqFt: number;
  /**
   * Perpetual vs temporary. Changes the valuation method entirely: a temporary
   * construction easement is valued as rent on the area for the term, not as a
   * share of fee value (spec §6.3).
   */
  readonly term: 'perpetual' | 'temporary';
  readonly termYears?: number;
  /** True where the holder may exclude the owner from the strip. */
  readonly exclusive: boolean;
  readonly provenance: EasementProvenance;
}

/**
 * Maps provenance onto the app-wide confidence vocabulary.
 *
 * Only a recorded instrument is `verified`. A proximity hit is `flagged`, never
 * `inferred`, because the companion spec is explicit that proximity does not
 * establish an easement — treating it as merely low-confidence would let a
 * nearby transmission line produce a dollar figure.
 */
export function provenanceConfidence(
  provenance: EasementProvenance,
): 'verified' | 'inferred' | 'flagged' {
  switch (provenance.kind) {
    case 'recorded-document':
      return 'verified';
    case 'plat-map':
      return 'verified';
    case 'county-gis':
      return 'inferred';
    case 'proximity-inference':
      return 'flagged';
    case 'user-asserted':
      return 'flagged';
  }
}
