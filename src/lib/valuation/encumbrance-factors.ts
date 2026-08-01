/**
 * Encumbrance factors — the share of fee value an easement takes.
 *
 * READ THIS BEFORE ADDING A NUMBER TO THIS FILE.
 *
 * The obvious design here is a lookup table: easement type -> percentage of
 * fee value. Research into the appraisal literature says that design is wrong,
 * and the two sources found independently agree.
 *
 * 1. Allen, Albert N. (SR/WA), "The Appraisal of Easements", *Right of Way*,
 *    International Right of Way Association, November/December 2001.
 *    Retrieved 2026-07-27 from https://eweb.irwaonline.org/eweb/upload/1101c.pdf
 *
 *    - "The proper valuation methodology for easements is the 'before and
 *      after' rule."
 *    - "Strictly speaking, the appraiser does not appraise an easement but
 *      rather measures the impact of the easement on the burdened property."
 *    - It names three flawed alternatives — "use of easement transactions as
 *      comparables, linear rules of thumb, and incorrect use of corridor
 *      valuation theory" — and states "some have serious flaws."
 *    - On published going rates specifically: "there may be an established
 *      going rate per pole, per line-mile, per rod, and the like ... the
 *      appraisal should not be based on such going rates but should be based
 *      upon the usual 'before and after' appraisal method."
 *    - "To use other techniques will almost invariably lead to an estimate of
 *      some value other than market value."
 *
 * 2. Texas A&M Transportation Institute, "Valuation Methodology and Framework
 *    for Estimation of Right-of-Way Value", Technical Report 0-7053-R1,
 *    sponsored by TxDOT. Retrieved 2026-07-27 from
 *    https://static.tti.tamu.edu/tti.tamu.edu/documents/0-7053-R1.pdf
 *
 *    - "For the valuation of easements, a common methodology is the
 *      before-and-after rule where a parcel is valued at its highest and best
 *      use without and then with the easement in place. A usage factor can
 *      then be calculated by taking the loss to the parcel owner and dividing
 *      by the before value."
 *
 * The consequence is the load-bearing point of this module: **the encumbrance
 * factor is an OUTPUT of a proper before-and-after appraisal, not an INPUT
 * looked up in a table.** A table of percentages inverts the causality. It is
 * not merely imprecise; per source 1 it produces "some value other than market
 * value," which is the wrong quantity rather than an approximate right one.
 *
 * So this module deliberately does NOT ship a populated factor table. It
 * encodes the methodology, records the one sourced datapoint actually found,
 * and makes every unsourced type unsourced *in the type system*, so a caller
 * cannot accidentally render a confident dollar figure from a number nobody
 * stands behind. This follows the repo norm established when an invented
 * rework cost was replaced with sourced regional construction data.
 */

import type { EasementType } from '@/lib/easements/easement-types';

/**
 * How a factor was arrived at. The discriminant exists so callers must branch:
 * a screening band and an appraised factor cannot be rendered identically.
 */
/**
 * The recognised approaches to valuing an easement, in the order the
 * literature ranks them. Recorded so the report can name the method it is NOT
 * performing, rather than implying it performed one.
 *
 * Sources: Allen (IRWA 2001) and TTI 0-7053-R1 for the primacy of
 * before-and-after; Uniform Appraisal Standards for Federal Land Acquisitions
 * (2016) §1.7.1 and §4.6.1 for the federal rule; the project easement analysis
 * guide for the state-rule variant and the income approach.
 */
export const VALUATION_METHODS = {
  beforeAndAfter:
    'Before-and-After (Federal Rule). Value the whole property before the easement, then the ' +
    'remainder after it; the difference is the easement value. Damage to the remainder is ' +
    'automatically included. This is the controlling federal method and the one the literature ' +
    'treats as correct.',
  takePlusDamages:
    'Value of Take Plus Damages (State Rule). Compensation is the value of the land taken plus ' +
    'damages to the remainder, computed separately. A variation on before-and-after used where ' +
    'state law requires it.',
  salesComparison:
    'Sales Comparison. Compare the subject against similar properties with and without the ' +
    'easement. Note that Allen (IRWA 2001) holds that sales OF easements are not valid ' +
    'comparables — the comparison must be between burdened and unburdened PROPERTIES.',
  incomeCapitalisation:
    'Income Capitalisation. Used where the easement generates ongoing revenue — pipeline rent, ' +
    'cell-tower lease. Capitalise the income stream. Requires observed market rents, not a ' +
    'percentage of fee value.',
  cost:
    'Cost Approach. Replacement cost of improvements less depreciation. Rarely applicable to ' +
    'vacant land or conservation easements.',
} as const;

export type FactorBasis =
  /**
   * Derived from an actual before-and-after analysis of this parcel:
   * (before value − after value) / before value. The only basis that yields
   * market value per the sources above. This app cannot compute it — it needs
   * a highest-and-best-use analysis of a specific property — so it arrives
   * from an appraiser, never from this module.
   */
  | { readonly kind: 'appraised-before-after'; readonly appraiserRef: string }
  /**
   * A published figure from a citable authority, usable for SCREENING ONLY.
   * Must carry its citation. Must never be presented as an appraisal.
   */
  | {
      readonly kind: 'published-screening';
      readonly citation: string;
      readonly retrievedOn: string;
      /** What the figure actually described. Guards against over-generalising. */
      readonly appliesTo: string;
    }
  /**
   * No sourced figure exists for this easement type. This is the honest state
   * for almost every type, and it is not a gap to be filled by estimating.
   */
  | { readonly kind: 'unsourced' };

export interface EncumbranceFactor {
  readonly type: EasementType;
  readonly basis: FactorBasis;
  /** Share of fee value, 0–1. Absent when the basis is `unsourced`. */
  readonly factor?: number;
  /** Present when the source gave a range rather than a point. */
  readonly range?: { readonly low: number; readonly high: number };
}

/**
 * The single sourced datapoint located in the literature review. It is a
 * worked case example, NOT a general factor for pipeline easements, and it is
 * recorded here with that limit attached so the next person does not have to
 * repeat the search — and does not mistake it for a table row.
 *
 * TTI 0-7053-R1, describing a method proposed in its reference (33): a 16-inch
 * pipeline in a 12-ft easement. The pipe diameter plus a 24-inch risk area
 * either side (64 inches total) is impacted at 85%; the remaining 80 inches at
 * 42.5%, "since they are less impacted and may be useful as an overlap or
 * buffer for other corridor uses." Weighted across the 12-ft easement this
 * gives 61.4%.
 */
export const TTI_PIPELINE_CASE_EXAMPLE: EncumbranceFactor = {
  type: 'pipeline',
  factor: 0.614,
  basis: {
    kind: 'published-screening',
    citation:
      'Texas A&M Transportation Institute, Technical Report 0-7053-R1, ' +
      '"Valuation Methodology and Framework for Estimation of Right-of-Way Value" ' +
      '(TxDOT), §2, worked example citing its reference (33).',
    retrievedOn: '2026-07-27',
    appliesTo:
      'ONE worked example: a 16-inch pipeline in a 12-ft easement, weighting an 85% impact over ' +
      'the 64-inch pipe-plus-risk-area against 42.5% over the remaining 80 inches. It is not a ' +
      'general factor for pipeline easements and must not be applied to a different pipe ' +
      'diameter, easement width, or product without redoing the weighting.',
  },
};

/**
 * Percentage ranges from the project easement analysis guide
 * (.claude/agents/easement_analysis_guide.md, Part 2).
 *
 * RECORDED, NOT ADOPTED. These are kept so the numbers are not lost and so the
 * next person does not re-derive them, but they are deliberately NOT wired into
 * `lookupEncumbranceFactor` and cannot reach a user-facing figure. Two reasons,
 * both already established in this module's header:
 *
 * 1. They carry no citation. The guide states them as typical ranges without a
 *    source that can be fetched and checked.
 * 2. Percentage-of-fee is the method the literature rejects. Allen (IRWA 2001)
 *    names "linear rules of thumb" among three alternatives with "serious
 *    flaws". The Uniform Appraisal Standards for Federal Land Acquisitions
 *    (2016) is blunter still in the analogous leasehold context: the method
 *    "can lead to 'gross over-valuation'", and federal courts have rejected it
 *    "even if comparable lease transactions are not available" — i.e. absence
 *    of comparables is not a licence to fall back on a percentage.
 *
 * They remain useful as an order-of-magnitude sanity check on a figure produced
 * by a proper before-and-after appraisal. A number far outside these bands is
 * worth re-examining. That is the only sanctioned use.
 */
export const UNCITED_SCREENING_RANGES: Readonly<
  Record<string, { readonly low: number; readonly high: number; readonly basis: string }>
> = {
  utility: { low: 0.25, high: 0.75, basis: 'share of underlying land value' },
  drainage: { low: 0.1, high: 0.4, basis: 'share of fee simple; open channel higher than buried pipe' },
  access: { low: 0.02, high: 0.08, basis: 'share of TOTAL property value, not of the strip' },
  conservation: { low: 0.4, high: 0.7, basis: 'share of development value' },
};

/**
 * Every easement type this app models, and the honest state of sourcing for
 * each. Deliberately almost all `unsourced` — see the module header. Do not
 * populate a row without a citation that has been fetched and read.
 */
export const ENCUMBRANCE_FACTORS: Readonly<Record<EasementType, EncumbranceFactor>> = {
  'utility-overhead': { type: 'utility-overhead', basis: { kind: 'unsourced' } },
  'utility-underground': { type: 'utility-underground', basis: { kind: 'unsourced' } },
  sewer: { type: 'sewer', basis: { kind: 'unsourced' } },
  'storm-drain': { type: 'storm-drain', basis: { kind: 'unsourced' } },
  'water-line': { type: 'water-line', basis: { kind: 'unsourced' } },
  pipeline: { type: 'pipeline', basis: { kind: 'unsourced' } },
  'access-ingress-egress': { type: 'access-ingress-egress', basis: { kind: 'unsourced' } },
  'public-right-of-way': { type: 'public-right-of-way', basis: { kind: 'unsourced' } },
  drainage: { type: 'drainage', basis: { kind: 'unsourced' } },
  slope: { type: 'slope', basis: { kind: 'unsourced' } },
  conservation: { type: 'conservation', basis: { kind: 'unsourced' } },
  prescriptive: { type: 'prescriptive', basis: { kind: 'unsourced' } },
};

/** Outcome of asking this module for a factor. */
export type FactorLookup =
  | { readonly status: 'available'; readonly factor: EncumbranceFactor }
  | {
      readonly status: 'unsourced';
      readonly type: EasementType;
      /** Copy explaining why no number is offered. Surface it; do not swallow it. */
      readonly explanation: string;
    };

const UNSOURCED_EXPLANATION =
  'No citable published factor has been sourced for this easement type. The appraisal ' +
  'literature holds that the proper method is a before-and-after analysis of the specific ' +
  'property, from which the factor is derived rather than looked up (Allen, IRWA 2001; ' +
  'TTI 0-7053-R1). A percentage applied without that analysis produces a figure that is not ' +
  'market value. No estimate is offered here.';

/**
 * Returns a factor only where one is genuinely sourced.
 *
 * Note there is no `defaultFactor` parameter and no fallback percentage. That
 * is the point: an easement type with no sourced factor must reach the user as
 * an explicit gap, matching `valuationConfidenceToTieredResult`, where a
 * figure with no source behind it is not surfaced as a number to anchor on.
 */
export function lookupEncumbranceFactor(type: EasementType): FactorLookup {
  const entry = ENCUMBRANCE_FACTORS[type];
  if (entry === undefined || entry.basis.kind === 'unsourced') {
    return { status: 'unsourced', type, explanation: UNSOURCED_EXPLANATION };
  }
  return { status: 'available', factor: entry };
}

/**
 * Methodology text for the report, so the product states what a defensible
 * number would require rather than implying it has produced one.
 */
export const BEFORE_AND_AFTER_METHODOLOGY_NOTE =
  'A defensible easement valuation is measured by the before-and-after rule: the property is ' +
  'appraised at its highest and best use without the easement, then again with the easement in ' +
  'place, and the difference is the loss. The appraiser does not value the easement itself but ' +
  'the impact of the easement on the burdened property (Allen, "The Appraisal of Easements", ' +
  'International Right of Way Association, 2001). Percentage-of-fee rules of thumb are ' +
  'explicitly criticised in that literature as producing a figure other than market value. Any ' +
  'figure this tool produces is a screening estimate to inform a conversation, not an appraisal, ' +
  'and cannot substitute for one in a compensation negotiation.';
