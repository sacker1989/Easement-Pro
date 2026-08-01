/**
 * Evidence tiers for infrastructure-implied encumbrances.
 *
 * WHAT THIS REPLACES. The screening layer was specified to emit statements
 * like "properties in this ZIP have a 73% probability of utility easements".
 * That cannot be produced: calibrating a probability needs parcels where an
 * easement is known to exist, and neither LA nor San Diego publishes a
 * recorded-easement layer. See docs/open-data-source-assessment.md §2.
 *
 * A percentage with nothing behind it is worse than no number, because it
 * anchors a reader harder than a range does and reads as measurement. This
 * module emits an ORDINAL statement instead — a tier derived from a geometric
 * fact — which says only what the geometry supports.
 *
 * The tiers come from .claude/agents/implied-easement-valuation.md and are
 * made executable here so the UI and the agent cannot drift apart.
 */

export type EvidenceTier = 'A' | 'B' | 'C';

/**
 * Width of the boundary strip within which infrastructure is treated as
 * abutting rather than merely nearby.
 *
 * THIS IS A STATED CONVENTION, NOT A MEASUREMENT. Tier A and tier C are
 * geometric facts — the feature either intersects the parcel or it does not.
 * Tier B is the judgment zone between them, and this constant is where that
 * judgment is written down so it can be argued with rather than buried.
 *
 * 15 ft is used because recorded utility and drainage easements along lot
 * lines are commonly annotated on plats at 10-15 ft, so infrastructure within
 * that distance of a boundary could plausibly sit inside a recorded boundary
 * easement that the parcel geometry does not reveal. That is a rationale, not
 * a calibration: no measured distribution of easement widths was available.
 * Override it per jurisdiction once one is.
 */
export const BOUNDARY_STRIP_FT = 15;

export interface TierAssessment {
  readonly tier: EvidenceTier;
  readonly distanceFt: number;
  /** The geometric fact the tier rests on. Always stated. */
  readonly basis: string;
  /** What this does and — more importantly — does not imply. */
  readonly implication: string;
  /**
   * Whether a valuation may be attempted at all. True only for tier A, and
   * even then only under stated assumptions: the tier is derived from
   * geometry, not from a recorded document, so provenance remains an
   * inference. See provenanceConfidence in easement-types.ts, which maps
   * proximity to `flagged` regardless of tier.
   */
  readonly mayValue: boolean;
}

export class EvidenceTierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EvidenceTierError';
  }
}

/**
 * Assigns a tier from the distance between a parcel boundary and a piece of
 * infrastructure.
 *
 * `distanceFt` must be measured from the parcel BOUNDARY, not its centroid — a
 * centroid distance is wrong for any parcel whose radius approaches the search
 * radius, and gets worse as parcels get larger. Zero means the feature
 * intersects the parcel.
 */
export function assessEvidenceTier(
  distanceFt: number,
  options: { boundaryStripFt?: number } = {},
): TierAssessment {
  const { boundaryStripFt = BOUNDARY_STRIP_FT } = options;

  if (!Number.isFinite(distanceFt) || distanceFt < 0) {
    throw new EvidenceTierError('Distance must be a non-negative finite number of feet');
  }

  if (distanceFt === 0) {
    return {
      tier: 'A',
      distanceFt,
      basis: 'The infrastructure intersects the parcel boundary — it crosses or sits on the land.',
      implication:
        'This is a real question worth pursuing. Infrastructure physically on private land with ' +
        'nothing in the deed can mean an unrecorded or prescriptive easement, or it can mean the ' +
        'operator is occupying the land without one — in which case the owner may be owed ' +
        'compensation rather than burdened. Which of those applies cannot be determined from ' +
        'geometry; it turns on the recorded documents and the history of the use.',
      mayValue: true,
    };
  }

  if (distanceFt <= boundaryStripFt) {
    return {
      tier: 'B',
      distanceFt,
      basis:
        `The infrastructure is within ${boundaryStripFt} ft of the parcel boundary but does not ` +
        'cross it.',
      implication:
        'Worth investigating, not concluding. Recorded utility and drainage easements are commonly ' +
        'written as strips along lot lines, so a feature this close may sit inside one that the ' +
        'parcel geometry does not show — or may sit entirely on the neighbouring parcel or in the ' +
        'public right of way. The plat will distinguish these; the geometry will not.',
      mayValue: false,
    };
  }

  return {
    tier: 'C',
    distanceFt,
    basis: `The infrastructure is ${Math.round(distanceFt)} ft away and does not touch the parcel.`,
    implication:
      'No encumbrance on this parcel is implied. Infrastructure near a property is not an easement ' +
      'on it, and nearby lines usually run in the public right of way or across other parcels. ' +
      'This is reported as context only.',
    mayValue: false,
  };
}

/** Ordering for display: on-parcel first, then ascending distance. */
export function compareFindings(a: TierAssessment, b: TierAssessment): number {
  const rank = { A: 0, B: 1, C: 2 } as const;
  return rank[a.tier] - rank[b.tier] || a.distanceFt - b.distanceFt;
}

/**
 * Summary line for a set of findings, replacing the probability sentence.
 *
 * Deliberately says how many and how close, and nothing about likelihood.
 */
export function summariseTiers(findings: readonly TierAssessment[]): string {
  const n = (t: EvidenceTier) => findings.filter((f) => f.tier === t).length;
  const a = n('A');
  const b = n('B');
  const c = n('C');

  if (a === 0 && b === 0) {
    return c === 0
      ? 'No infrastructure was found within the search radius in the layers checked.'
      : `No infrastructure touches this parcel. ${c} feature${c === 1 ? '' : 's'} ` +
        `${c === 1 ? 'was' : 'were'} found nearby, none of which implies an encumbrance here.`;
  }

  const parts: string[] = [];
  if (a > 0) parts.push(`${a} crossing the parcel`);
  if (b > 0) parts.push(`${b} within ${BOUNDARY_STRIP_FT} ft of the boundary`);
  return (
    `${parts.join(' and ')}. This indicates a question to investigate against the recorded ` +
    `documents — it does not establish that an easement exists.` +
    (c > 0 ? ` A further ${c} feature${c === 1 ? '' : 's'} nearby imply nothing about this parcel.` : '')
  );
}
