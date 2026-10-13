import { assessEvidenceTier, type TierAssessment } from '@/lib/easements/evidence-tier';
import { featureToParcelFt, localScale, ringCentroid, type LngLat } from '@/lib/geo/planar-distance';
import type { InfrastructureFeature, InfrastructureResult } from './infrastructure';

/**
 * Turns infrastructure near a parcel into tiered findings.
 *
 * THE JOIN BETWEEN THE TWO HALVES: `infrastructure.ts` fetches features,
 * `geo/planar-distance.ts` measures them against the parcel ring, and
 * `evidence-tier.ts` says what a distance means. Keeping the join separate
 * from both means the measurement can be tested without the network and the
 * fetching without the geometry.
 */

export interface InfrastructureFinding {
  readonly feature: InfrastructureFeature;
  readonly assessment: TierAssessment;
}

export type ParcelInfrastructure =
  | {
      readonly kind: 'assessed';
      /** Sorted strongest evidence first: A, then B, then C by distance. */
      readonly findings: readonly InfrastructureFinding[];
      readonly radiusFt: number;
      readonly queriedOn: string;
    }
  /**
   * The scan ran and matched nothing within the radius.
   *
   * ITS OWN CASE, AND THE NAME IS THE POINT. OpenStreetMap maps transmission
   * well and residential distribution poorly, so this is the ordinary answer
   * for an ordinary suburban street whose poles nobody has traced. Rendering
   * it as "no infrastructure near this property" would tell a homeowner their
   * land is clear on the strength of a gap in a volunteer map.
   */
  | { readonly kind: 'none-mapped'; readonly radiusFt: number; readonly queriedOn: string }
  /** No parcel polygon, so no boundary to measure from. */
  | { readonly kind: 'no-parcel-geometry' }
  | { readonly kind: 'lookup-failed'; readonly reason: string };

/**
 * Orders findings so the strongest evidence is first.
 *
 * Tier before distance: a feature crossing the parcel outranks one 3 ft away
 * that does not, because the tiers are categorically different claims rather
 * than points on a scale.
 */
function strongestFirst(a: InfrastructureFinding, b: InfrastructureFinding): number {
  if (a.assessment.tier !== b.assessment.tier) {
    return a.assessment.tier < b.assessment.tier ? -1 : 1;
  }
  return a.assessment.distanceFt - b.assessment.distanceFt;
}

/**
 * Measures each feature against the parcel boundary and tiers it.
 *
 * `ring` must be the parcel polygon in [lng, lat]. Without it there is no
 * boundary, and a tier measured from the geocoded point instead would be
 * exactly the centroid distance `assessEvidenceTier` warns against — wrong
 * for any parcel whose radius approaches the search radius, and wrong in the
 * direction of overstating the tier.
 */
export function assessParcelInfrastructure(
  lookup: InfrastructureResult,
  ring: readonly LngLat[] | null,
): ParcelInfrastructure {
  if (lookup.kind === 'lookup-failed') {
    return { kind: 'lookup-failed', reason: lookup.reason };
  }
  if (ring === null || ring.length < 3) {
    return { kind: 'no-parcel-geometry' };
  }
  if (lookup.kind === 'none-mapped') {
    return { kind: 'none-mapped', radiusFt: lookup.radiusFt, queriedOn: lookup.queriedOn };
  }

  const scale = localScale(ringCentroid(ring)[1]);
  const findings = lookup.features
    .map((feature): InfrastructureFinding | null => {
      const distanceFt = featureToParcelFt(feature.geometry, ring, scale);
      if (!Number.isFinite(distanceFt)) return null;
      return { feature, assessment: assessEvidenceTier(distanceFt) };
    })
    .filter((f): f is InfrastructureFinding => f !== null)
    .sort(strongestFirst);

  if (findings.length === 0) {
    return { kind: 'none-mapped', radiusFt: lookup.radiusFt, queriedOn: lookup.queriedOn };
  }
  return { kind: 'assessed', findings, radiusFt: lookup.radiusFt, queriedOn: lookup.queriedOn };
}

/**
 * The sentence that must accompany any rendering of this scan.
 *
 * NOT OPTIONAL AND NOT A FOOTNOTE. The scan's failure mode is silence: a
 * street whose poles nobody has traced looks identical to a street with no
 * poles. A reader who takes the first for the second has been reassured by a
 * gap in a volunteer dataset, which is the one outcome this feature must not
 * produce.
 */
export const COVERAGE_CAVEAT =
  'This scan reads OpenStreetMap, a volunteer map. It records long-distance transmission lines ' +
  'well and the poles and cables on ordinary residential streets poorly. Finding nothing here is ' +
  'not evidence that nothing is there — it means nothing has been mapped. What is on your deed ' +
  'and your plat is the authority; this is a prompt to go and look.';

/** Said wherever a tier is shown, so geometry is never read as a document. */
export const GEOMETRY_IS_NOT_A_DEED =
  'These are measurements of where things are, not findings about what is recorded. ' +
  'Infrastructure crossing a parcel can mean an easement nobody wrote down, and it can equally ' +
  'mean an operator occupying land without one — in which case the owner may be owed something ' +
  'rather than burdened by it. Geometry cannot tell those apart.';
