/**
 * IRWA Easement Valuation Matrix
 * Source: Donnie Sherwood, SR/WA, MAI, FRICS — "Valuation of Easements" (IRWA methodology)
 * Maps easement impact tiers to percentage-of-fee-value ranges.
 *
 * ============================================================================
 * CONFLICT NOTICE — read before using this matrix. Added 2026-08-02.
 *
 * This is a percentage-of-fee table. Later research reached the opposite
 * conclusion about that method, and the two have not been reconciled:
 *
 *   - Allen, "The Appraisal of Easements", IRWA, Nov/Dec 2001, names "linear
 *     rules of thumb" among three alternative methods with "serious flaws".
 *     Note that BOTH this file and that source are IRWA material.
 *   - Uniform Appraisal Standards for Federal Land Acquisitions (2016) §4.6.5
 *     is stronger: it rejects percentage-of-fee, rejects customary going
 *     rates, and rejects "strip valuation" — valuing only the encumbered area
 *     — as failing to compare the whole tract before and after, which it calls
 *     "the correct measure of value in federal court condemnation".
 *   - Accordingly src/lib/valuation/encumbrance-factors.ts ships its factor
 *     table DELIBERATELY EMPTY, with tests asserting it stays empty.
 *
 * So this module and encumbrance-factors.ts currently contradict each other,
 * and calculator.ts computes area x unit value x percentage — the shape §4.6.5
 * names and rejects.
 *
 * DIRECTION GIVEN 2026-08-22: "use the valuation that has the higher amount."
 * NOT IMPLEMENTED, and the reasons are worth stating rather than filing.
 *
 * 1. Read literally it is degenerate. encumbrance-factors.ts has no amounts —
 *    it is empty BY DESIGN and returns `unsourced` for all twelve types. "The
 *    higher of the two" therefore resolves to "always this table", which is
 *    not a reconciliation of the conflict but a silent win for the side the
 *    later research rejected.
 * 2. Selecting a valuation method by which yields the larger number is not a
 *    valuation method. It chooses for outcome rather than for accuracy, and it
 *    is the specific move that turns a screening tool into an advocacy tool
 *    making claims it cannot support.
 * 3. The direction favours our own user, which is the dangerous direction for
 *    this product — the same finding recorded against review item 5. A
 *    homeowner who believes they are owed more than they are may reject a fair
 *    offer, or litigate on a premise that does not hold.
 * 4. THE STATED GOAL IS ALREADY MET WITHOUT IT. screening-estimate.ts emits a
 *    RANGE, and the top of that range is the favourable end — 75% of the strip
 *    for a utility easement, not an average. Nothing truncates it. Replacing
 *    the range with a single higher number would make the product's output
 *    weaker for the homeowner, not stronger, because a lone figure invites
 *    reliance that a band does not.
 *
 * What would change behaviour is a decision to wire a percentage table into
 * the handoff path at all, which is a different question from which table. It
 * needs the appraiser review recorded at SCREENING-BANDS-UNCITED, not a
 * tie-break rule.
 *
 * The conflict may be resolvable rather than fatal: the Yellow Book governs
 * FEDERAL just-compensation appraisal, while a screening estimate for a
 * homeowner facing a utility easement is a different context, and IRWA members
 * do publish percentage matrices as practice tools. But that is a product and
 * legal decision, not a code cleanup, and it has not been made.
 *
 * UNTIL IT IS: do not present output derived from this matrix as market value,
 * as compensation, or as an appraisal. The Sherwood source has not been
 * retrieved and verified in this repo — the attribution is carried forward
 * from Phase 1, not checked.
 *
 * See docs/spec-easement-valuation.md §6.1 (superseded) and §6.1a.
 * ============================================================================
 */

export interface ImpactTier {
  readonly name: string;
  readonly description: string;
  readonly lowPercent: number;
  readonly highPercent: number;
}

export const IMPACT_TIERS: Record<string, ImpactTier> = {
  severe: {
    name: 'Severe',
    description:
      'Severe impact on surface use, conveyance of future uses (e.g., overhead electric, flowage, major rail/canal)',
    lowPercent: 90,
    highPercent: 100,
  },
  major: {
    name: 'Major',
    description:
      'Major impact on surface use, conveyance of future uses (e.g., pipelines, drainage, flowage)',
    lowPercent: 75,
    highPercent: 89,
  },
  moderate_high: {
    name: 'Moderate-High',
    description: 'Some impact on surface use, ingress/egress rights (e.g., pipelines, scenic)',
    lowPercent: 51,
    highPercent: 74,
  },
  balanced: {
    name: 'Balanced',
    description: 'Balanced use by owner and holder (e.g., sewer/water lines 50/50 split)',
    lowPercent: 50,
    highPercent: 50,
  },
  moderate_low: {
    name: 'Moderate-Low',
    description:
      'Location along property line/setback, minor utility (e.g., water/sewer, cable, telecom)',
    lowPercent: 26,
    highPercent: 49,
  },
  minor: {
    name: 'Minor',
    description:
      'Nominal effect, air/water/sewer with minimal utility disruption',
    lowPercent: 11,
    highPercent: 25,
  },
  minimal: {
    name: 'Minimal',
    description: 'Small subsurface easement, zero to negligible surface impact',
    lowPercent: 0,
    highPercent: 10,
  },
};

/**
 * Resolve the percentage-of-fee-value for a given impact tier.
 * If custom percentage is provided, use it; otherwise use the midpoint of the tier range.
 */
export function resolveImpactPercentage(
  impactTier: string,
  customPercentage?: number,
): number {
  if (customPercentage !== undefined) {
    if (customPercentage < 0 || customPercentage > 100) {
      throw new RangeError('Custom percentage must be between 0 and 100');
    }
    return customPercentage;
  }

  const tier = IMPACT_TIERS[impactTier];
  if (!tier) {
    throw new Error(
      `Invalid impact tier "${impactTier}". Choose from: ${Object.keys(IMPACT_TIERS).join(', ')}`,
    );
  }

  return (tier.lowPercent + tier.highPercent) / 2;
}
