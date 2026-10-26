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

declare const evidenceTierBrand: unique symbol;

/**
 * Evidence tier: A on-parcel, B within the boundary strip, C nearby only.
 *
 * BRANDED DELIBERATELY. StateTier in src/lib/gating/state-tier-config.ts is
 * also literally 'A' | 'B' | 'C', and means something entirely unrelated —
 * a state's UPL/licensing classification. Without a brand, TypeScript treats
 * the two as interchangeable, so an evidence tier could be passed wherever a
 * state tier is expected and neither the compiler nor a reviewer would notice.
 *
 * The phase specs add further ordinal axes, so the overlap gets worse rather
 * than better. The brand is one-directional: an EvidenceTier is still usable
 * anywhere a plain 'A' | 'B' | 'C' is wanted (indexing, comparison), but a
 * bare literal or a StateTier cannot be used as one. Construct via evidenceTier().
 */
export type EvidenceTier = ('A' | 'B' | 'C') & { readonly [evidenceTierBrand]: true };

/** The only sanctioned way to make an EvidenceTier. */
export function evidenceTier(t: 'A' | 'B' | 'C'): EvidenceTier {
  return t as EvidenceTier;
}

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
  /**
   * True when the tier was capped because the publisher inferred the position.
   *
   * A FLAG RATHER THAN A STRING MATCH ON `basis`. Without it, anything
   * downstream that needs to treat a capped finding differently — a summary
   * line, a referral package, a renderer — has to recognize the wording,
   * which breaks the moment the wording is edited. A tier C finding that was
   * capped and one that is genuinely 300 ft away are not the same claim and
   * must stay distinguishable without reading prose.
   */
  readonly positionInferred: boolean;
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
  options: { boundaryStripFt?: number; geometryQuality?: 'mapped' | 'inferred' } = {},
): TierAssessment {
  const { boundaryStripFt = BOUNDARY_STRIP_FT, geometryQuality = 'mapped' } = options;

  if (!Number.isFinite(distanceFt) || distanceFt < 0) {
    throw new EvidenceTierError('Distance must be a non-negative finite number of feet');
  }

  /*
   * AN INFERRED ALIGNMENT CANNOT SUPPORT TIER A OR B, whatever the arithmetic
   * says. Tier A means "this crosses the land" and tier B means "this is
   * within 15 ft of the boundary"; both are claims about position, and the
   * publisher of an inferred record has declined to make one. The federal
   * transmission layer reconstructs those routes from aerial imagery and EIA
   * filings and states no positional tolerance, so a 4 ft reading and a 40 ft
   * reading are not distinguishable at parcel scale.
   *
   * THIS CHECK RUNS FIRST, BEFORE THE DISTANCE BRANCHES, because the harm is
   * one-directional. An inferred line drawn a few feet off its true route
   * would promote an ordinary parcel to "infrastructure crosses your land" —
   * the strongest thing this product ever says, the only tier that permits a
   * valuation, and in Cook County it would be said off inferred geometry 88%
   * of the time. Degrading in the other direction costs the reader a prompt
   * to go and look; the distance is still reported, and so is the reason.
   */
  if (geometryQuality === 'inferred') {
    return {
      tier: evidenceTier('C'),
      distanceFt,
      basis:
        `The published route passes ${Math.round(distanceFt)} ft from this parcel, but the ` +
        'publisher marks this line’s position as inferred — reconstructed from aerial imagery ' +
        'and utility filings rather than surveyed.',
      implication:
        'The line is there; where exactly it runs is not established. No tier is assigned from ' +
        'this distance, because the publisher states no positional tolerance and at the scale of ' +
        'a house lot the difference matters. Treat it as a reason to look at your plat and to ask ' +
        'the operator for the recorded alignment, not as a measurement of how close it is to ' +
        'your boundary.',
      mayValue: false,
      positionInferred: true,
    };
  }

  if (distanceFt === 0) {
    return {
      tier: evidenceTier('A'),
      distanceFt,
      basis: 'The infrastructure intersects the parcel boundary — it crosses or sits on the land.',
      implication:
        'This is a real question worth pursuing. Infrastructure physically on private land with ' +
        'nothing in the deed can mean an unrecorded or prescriptive easement, or it can mean the ' +
        'operator is occupying the land without one — in which case the owner may be owed ' +
        'compensation rather than burdened. Which of those applies cannot be determined from ' +
        'geometry; it turns on the recorded documents and the history of the use.',
      mayValue: true,
      positionInferred: false,
    };
  }

  if (distanceFt <= boundaryStripFt) {
    return {
      tier: evidenceTier('B'),
      distanceFt,
      basis:
        `The infrastructure is within ${boundaryStripFt} ft of the parcel boundary but does not ` +
        'cross it.',
      implication:
        'Worth investigating, not concluding. Recorded utility and drainage easements are commonly ' +
        'written as strips along lot lines, so a feature this close may sit inside one that the ' +
        'parcel geometry does not show — or may sit entirely on the neighboring parcel or in the ' +
        'public right of way. The plat will distinguish these; the geometry will not.',
      mayValue: false,
      positionInferred: false,
    };
  }

  return {
    tier: evidenceTier('C'),
    distanceFt,
    basis: `The infrastructure is ${Math.round(distanceFt)} ft away and does not touch the parcel.`,
    /*
     * THE SECOND SENTENCE WAS ADDED AFTER MEASUREMENT, and it exists because
     * the first one is easy to misread in the dangerous direction.
     *
     * "No encumbrance is implied" is accurate about THIS infrastructure and
     * reads, to a homeowner, as "you probably have no easement". The
     * Lawrence calibration says otherwise: of 245 tier-C parcels, 191 —
     * 78% — carried a recorded easement overlapping the lot. The tier is not
     * a test for whether an easement exists and must never be read as one.
     * See docs/easement-tier-calibration.md.
     */
    implication:
      'No encumbrance on this parcel is implied BY THIS INFRASTRUCTURE. Something near a property ' +
      'is not an easement on it, and nearby lines usually run in the public right of way or across ' +
      'other parcels. This is reported as context only. It is not evidence that your parcel is ' +
      'free of easements — where that has been measured, most platted lots carry at least one ' +
      'recorded easement whatever is or is not nearby, and only the deed and the plat will say.',
    mayValue: false,
    positionInferred: false,
  };
}

/** Ordering for display: on-parcel first, then ascending distance. */
export function compareFindings(a: TierAssessment, b: TierAssessment): number {
  const rank = (t: EvidenceTier): number => (t === 'A' ? 0 : t === 'B' ? 1 : 2);
  return rank(a.tier) - rank(b.tier) || a.distanceFt - b.distanceFt;
}

/**
 * Summary line for a set of findings, replacing the probability sentence.
 *
 * Deliberately says how many and how close, and nothing about likelihood.
 */
export function summariseTiers(
  findings: readonly TierAssessment[],
  /**
   * Whether these findings come from a RECORDED easement layer rather than
   * from inferring an encumbrance out of infrastructure geometry.
   *
   * This matters and was got wrong once. The default text says the finding
   * "does not establish that an easement exists", which is correct for a power
   * line seen crossing a parcel and WRONG for Orange County's Encumbrances
   * layer, where the county publishes the easement itself with an estate code,
   * an acquisition date and a document reference. Understating recorded
   * evidence is its own error, not a safe default.
   */
  fromRecordedEasements = false,
): string {
  const n = (t: EvidenceTier) => findings.filter((f) => f.tier === t).length;
  const a = n(evidenceTier('A'));
  const b = n(evidenceTier('B'));
  const c = n(evidenceTier('C'));

  if (a === 0 && b === 0) {
    if (c === 0) return 'No infrastructure was found within the search radius in the layers checked.';
    /*
     * "NO INFRASTRUCTURE TOUCHES THIS PARCEL" IS A CLAIM THIS CANNOT MAKE
     * WHEN A FINDING WAS CAPPED. An inferred transmission route can be
     * published running straight across the lot — one did, 0 ft from the test
     * ring at a ComEd corridor near Cicero — and it lands in tier C only
     * because the position is not established, not because the line is
     * elsewhere. Asserting it does not touch the parcel would launder the
     * refusal into a reassurance, which is the single failure this whole flag
     * exists to prevent.
     */
    const inferred = findings.filter((f) => f.positionInferred).length;
    if (inferred > 0) {
      return (
        `Nothing with an established position touches this parcel. ${c} feature` +
        `${c === 1 ? ' was' : 's were'} found nearby, and for ${inferred} of them the publisher ` +
        `marks the route as inferred rather than surveyed — so whether ${
          inferred === 1 ? 'it crosses' : 'they cross'
        } the land cannot be read off the map. Your plat and the operator’s records can say.`
      );
    }
    return (
      `No infrastructure touches this parcel. ${c} feature${c === 1 ? '' : 's'} ` +
      `${c === 1 ? 'was' : 'were'} found nearby, none of which implies an encumbrance here.`
    );
  }

  const parts: string[] = [];
  if (a > 0) parts.push(`${a} crossing the parcel`);
  if (b > 0) parts.push(`${b} within ${BOUNDARY_STRIP_FT} ft of the boundary`);

  const claim = fromRecordedEasements
    ? `These are recorded encumbrances published by the county, not inferences from nearby ` +
      `infrastructure. Confirm the terms and dimensions against the referenced document.`
    : `This indicates a question to investigate against the recorded documents — it does not ` +
      `establish that an easement exists.`;

  return (
    `${parts.join(' and ')}. ${claim}` +
    (c > 0 ? ` A further ${c} feature${c === 1 ? '' : 's'} nearby imply nothing about this parcel.` : '')
  );
}
