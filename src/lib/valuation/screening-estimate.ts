/**
 * A ROUGH SCREENING RANGE, for orientation before a professional is engaged.
 *
 * WHAT CHANGED AND WHY. This module deliberately did not exist. The project's
 * position was that no defensible permanent-easement figure can be computed
 * from data, which remains true and is restated in every output below. The
 * product decision is that a homeowner with no figure at all cannot tell
 * whether they are looking at a $500 problem or a $50,000 one, and therefore
 * cannot decide whether to spend $600 on an appraiser to find out. An
 * order-of-magnitude range, labelled as such, is what makes that decision
 * possible.
 *
 * THE DISTINCTION THAT MAKES THIS DEFENSIBLE. Uniform Appraisal Standards
 * §4.6.5 governs what an APPRAISER may do when preparing an appraisal for
 * federal condemnation. It rejects percentage-of-fee, going rates and strip
 * valuation AS APPRAISAL METHODS. It does not govern telling a property owner
 * "easements of this kind have shown effects in this band, here is the
 * arithmetic, and here is why the appraiser you hire will not use it."
 *
 * That distinction only holds if the output actually behaves that way, so:
 *
 *   - It is always a RANGE, never a point estimate. `pointEstimate` does not
 *     exist on the result type, so no caller can render one.
 *   - The arithmetic is shown, including the multiplier used, because a figure
 *     whose derivation is hidden reads as an authority claim.
 *   - It states, in the same block as the number, that this is the method the
 *     controlling standard rejects for appraisals.
 *   - It refuses outright wherever the underlying range does not exist, rather
 *     than substituting a neighbouring one.
 *
 * THE DENOMINATOR TRAP, WHICH IS THE EASY WAY TO GET THIS BADLY WRONG.
 * `UNCITED_SCREENING_RANGES` carries four bands and they are NOT commensurable:
 *
 *   - utility 25–75% is a share of the UNDERLYING LAND VALUE OF THE STRIP.
 *   - drainage 10–40% is a share of the fee simple of the strip.
 *   - access 2–8% is a share of the TOTAL PROPERTY VALUE — its own `basis`
 *     string says "not of the strip". Applying it to the strip instead would
 *     understate an access easement by roughly the ratio of the strip to the
 *     whole parcel, commonly one to two orders of magnitude.
 *   - conservation 40–70% is a share of DEVELOPMENT value, which this product
 *     does not have and cannot derive, so conservation is refused.
 *
 * Three denominators across four bands. Treating them alike is the same class
 * of error as reading a Web Mercator area as square feet.
 */

import type { EasementType } from '@/lib/easements/easement-types';
import { UNCITED_SCREENING_RANGES, YELLOW_BOOK_4_6_5 } from './encumbrance-factors';

export class ScreeningEstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningEstimateError';
  }
}

/** What the percentage band is a share OF. Not interchangeable. */
export type ScreeningDenominator =
  /** Land value of the encumbered strip alone. */
  | 'strip-land-value'
  /** Land plus improvements for the whole parcel. */
  | 'total-property-value'
  /** Development value. Not derivable here. */
  | 'development-value';

interface BandDefinition {
  readonly key: keyof typeof UNCITED_SCREENING_RANGES | null;
  readonly denominator: ScreeningDenominator | null;
  /** Why no band applies, when key is null. */
  readonly refusal?: string;
}

/**
 * Easement type to screening band, exhaustive by construction.
 *
 * A `null` key means no band is offered. That is a real answer, not a gap:
 * four of the twelve types have nothing citable behind them and substituting
 * a neighbouring band would invent the number.
 */
export const SCREENING_BAND_BY_TYPE = {
  'utility-overhead': { key: 'utility', denominator: 'strip-land-value' },
  'utility-underground': { key: 'utility', denominator: 'strip-land-value' },
  'water-line': { key: 'utility', denominator: 'strip-land-value' },
  sewer: { key: 'utility', denominator: 'strip-land-value' },
  'storm-drain': { key: 'drainage', denominator: 'strip-land-value' },
  drainage: { key: 'drainage', denominator: 'strip-land-value' },
  'access-ingress-egress': { key: 'access', denominator: 'total-property-value' },
  'public-right-of-way': { key: 'access', denominator: 'total-property-value' },
  conservation: {
    key: null,
    denominator: 'development-value',
    refusal:
      'The published band for conservation easements is 40-70% of DEVELOPMENT value — what the ' +
      'land would be worth if it could be developed. This product has no way to establish that ' +
      'figure, and substituting assessed land value would answer a different question. A ' +
      'conservation easement also restricts the whole parcel by the terms of its own instrument ' +
      'rather than a strip, so the area-based arithmetic below does not describe it.',
  },
  pipeline: {
    key: null,
    denominator: null,
    refusal:
      'No general band exists for pipelines. The one published figure available to this project ' +
      'is a single worked example — a 16-inch pipe in a 12-foot easement — whose own source ' +
      'states it must not be applied to a different diameter, width or product without redoing ' +
      'the weighting. Pipeline compensation also turns on operator agreements and safety setbacks ' +
      'that no percentage captures.',
  },
  slope: {
    key: null,
    denominator: null,
    refusal:
      'No published band has been sourced for slope easements. A slope easement usually restricts ' +
      'excavation and loading rather than occupation, so its effect on value does not scale with ' +
      'area the way the bands above assume.',
  },
  prescriptive: {
    key: null,
    denominator: null,
    refusal:
      'A prescriptive easement has no recorded instrument and its scope is whatever use ' +
      'established it — a question of fact, and ultimately for a court. Whether one exists at all ' +
      'is usually the contested issue, so there is nothing stable to apply a percentage to.',
  },
} as const satisfies Record<EasementType, BandDefinition>;

export interface ScreeningInputs {
  readonly easementType: EasementType;
  /** Assessed land value per sq ft. Required for strip-denominated bands. */
  readonly landValuePerSqFt: number | null;
  readonly encumberedAreaSqFt: number | null;
  /** Land + improvements. Required for total-property-denominated bands. */
  readonly totalPropertyValue: number | null;
  /** Where the value came from, carried into the output verbatim. */
  readonly valueSource: string;
  /** Set when the underlying assessment has no established base year. */
  readonly assessmentVintageUnknown: boolean;
}

export interface ScreeningRange {
  /** Dollars. Always a range — there is deliberately no point estimate. */
  readonly low: number;
  readonly high: number;
  readonly lowPercent: number;
  readonly highPercent: number;
  readonly denominator: ScreeningDenominator;
  /** The dollar base the percentages were applied to. */
  readonly appliedTo: number;
  readonly appliedToLabel: string;
  /** The arithmetic, spelled out. */
  readonly derivation: string;
  /** Every caveat that must render with the figure. */
  readonly caveats: readonly string[];
}

export type ScreeningResult =
  | { readonly status: 'range'; readonly range: ScreeningRange }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'insufficient-data'; readonly missing: readonly string[]; readonly reason: string };

/**
 * The three regulatory regimes, stated together.
 *
 * Rendered wherever a screening figure appears. Separated by regime rather
 * than merged into one paragraph because they are three different limits with
 * three different consequences, and a homeowner deciding what to do next needs
 * to know which one applies to which question.
 */
export const THREE_REGIME_DISCLOSURE = {
  valuation:
    'THIS IS NOT AN APPRAISAL. An appraisal is a licensed activity. The figure below was produced ' +
    'by multiplying a published percentage band by your county assessment — the "percentage of ' +
    'fee" method, which the controlling federal standard expressly rejects as a measure of ' +
    'compensation. The correct measure is the value of your whole property before the easement ' +
    'minus its value afterwards, which requires a licensed appraiser inspecting your property. ' +
    `${YELLOW_BOOK_4_6_5.citation}`,
  // Phrasing note: an earlier draft read "what you are entitled to are legal
  // questions". The claim scanner caught it, correctly — "you are entitled to"
  // is a forbidden pattern precisely because it is how a compensation promise
  // is phrased, and the scanner cannot tell a disclaimer from an assertion at
  // the sentence level. The fix is to reword the disclosure, never to soften
  // the guard.
  legal:
    'THIS IS NOT LEGAL ADVICE. Whether an easement exists, what its terms permit, whether it was ' +
    'validly created, and what rights you hold are legal questions. This tool reads public ' +
    'records; it does not interpret your rights. An attorney licensed in your state is the only ' +
    'person who can answer those, and in many states it is a crime for anyone else to try.',
  advertising:
    'THIS IS AN ESTIMATE FOR ORIENTATION, NOT A SUBSTANTIATED CLAIM ABOUT YOUR PROPERTY. The ' +
    'percentage bands come from general industry literature and carry no citation this project ' +
    'could verify. They describe a spread across many properties, not a prediction about yours. ' +
    'Any settlement, offer or award you actually receive may fall far outside this range.',
} as const;

/** Rendered immediately beside the number, never in a footer. */
/**
 * PRODUCT POSITION ON ITEM 9, recorded 2026-08-22 (product owner, NOT counsel):
 * showing the figure does not create exposure that language cannot cure; the
 * risk is an assumed figure being taken for fact.
 *
 * That is the reading this module was already built to, and it is why the
 * design invests in the SHAPE of the output rather than in the wording alone —
 * wording is what a reader skips. The structural defences are: no
 * `pointEstimate` field exists for any caller to render, the arithmetic is
 * printed beside the number, the figure is rounded hard so it cannot imply
 * precision, and the page renders it BELOW the not-determined panel by a rule
 * the suite asserts. A disclaimer can be skimmed past; a missing field cannot.
 *
 * STILL UNREVIEWED. The position is the product owner's, and it is a judgement
 * about exposure, which is the kind of judgement counsel exists to make. It
 * does not close item 9.
 */
export const ORIENTATION_ONLY_BANNER =
  'ROUGH ORIENTATION RANGE — NOT A VALUATION. Use this only to judge the SCALE of the question ' +
  'and whether it is worth engaging a professional. Do not quote it to a utility, an agency, an ' +
  'insurer or a court, and do not rely on it in a negotiation.';

function round(n: number): number {
  // Rounded hard, on purpose. Presenting $4,812.37 from a 25-75% band borrowed
  // from general literature would imply a precision the input cannot carry.
  if (n >= 100_000) return Math.round(n / 5_000) * 5_000;
  if (n >= 10_000) return Math.round(n / 500) * 500;
  if (n >= 1_000) return Math.round(n / 100) * 100;
  return Math.round(n / 10) * 10;
}

/**
 * Produces a screening range, or explains why it will not.
 *
 * Refusal is a normal outcome. Four of twelve easement types have no band, and
 * a missing land value or area also refuses rather than assuming one.
 */
export function screeningEstimate(inputs: ScreeningInputs): ScreeningResult {
  const band = SCREENING_BAND_BY_TYPE[inputs.easementType];

  if (band.key === null) {
    return { status: 'refused', reason: band.refusal };
  }

  const published = UNCITED_SCREENING_RANGES[band.key];
  if (published === undefined) {
    throw new ScreeningEstimateError(
      `Band "${band.key}" is named by SCREENING_BAND_BY_TYPE but absent from ` +
        'UNCITED_SCREENING_RANGES. These two must not drift apart.',
    );
  }

  const missing: string[] = [];
  let appliedTo: number;
  let appliedToLabel: string;
  let derivation: string;

  if (band.denominator === 'total-property-value') {
    // The access band is a share of the WHOLE property, not of the strip. Its
    // own basis string says so. Area does not enter this calculation at all.
    if (inputs.totalPropertyValue === null || inputs.totalPropertyValue <= 0) {
      missing.push('total assessed property value (land plus improvements)');
    }
    if (missing.length > 0) {
      return {
        status: 'insufficient-data',
        missing,
        reason:
          'The band for this easement type is a share of total property value, which is not ' +
          'available for this parcel. No figure is offered rather than one built on a substitute.',
      };
    }
    appliedTo = inputs.totalPropertyValue!;
    appliedToLabel = 'total assessed property value';
    derivation =
      `${(published.low * 100).toFixed(0)}–${(published.high * 100).toFixed(0)}% of the total ` +
      `assessed property value of $${appliedTo.toLocaleString()}. This band is a share of the ` +
      'WHOLE property, not of the easement strip — applying it to the strip would understate it ' +
      'by one to two orders of magnitude.';
  } else {
    if (inputs.landValuePerSqFt === null || inputs.landValuePerSqFt <= 0) {
      missing.push('assessed land value per square foot');
    }
    if (inputs.encumberedAreaSqFt === null || inputs.encumberedAreaSqFt <= 0) {
      missing.push('encumbered area in square feet');
    }
    if (missing.length > 0) {
      return {
        status: 'insufficient-data',
        missing,
        reason:
          'A strip-based band needs both a land value per square foot and an encumbered area. ' +
          'One or both is missing, and this tool does not assume a default width or a default ' +
          'land value.',
      };
    }
    appliedTo = inputs.landValuePerSqFt! * inputs.encumberedAreaSqFt!;
    appliedToLabel = 'assessed land value of the encumbered strip';
    derivation =
      `${inputs.encumberedAreaSqFt!.toLocaleString()} sq ft × ` +
      `$${inputs.landValuePerSqFt!.toFixed(2)}/sq ft = $${Math.round(appliedTo).toLocaleString()} ` +
      `of land under the easement, × ${(published.low * 100).toFixed(0)}–` +
      `${(published.high * 100).toFixed(0)}%.`;
  }

  const caveats: string[] = [
    ORIENTATION_ONLY_BANNER,
    THREE_REGIME_DISCLOSURE.valuation,
    THREE_REGIME_DISCLOSURE.legal,
    THREE_REGIME_DISCLOSURE.advertising,
    `Percentage band basis: ${published.basis}.`,
    `Value source: ${inputs.valueSource}`,
  ];

  if (inputs.assessmentVintageUnknown) {
    // Prop 13 makes this material rather than pedantic: an assessment frozen
    // at a decades-old base year can sit far below current market, and the
    // range inherits that error in full.
    caveats.push(
      'The assessment behind this figure has no established base year, so there is no way to tell ' +
        'whether it reflects current market or a valuation frozen decades ago. Under Proposition ' +
        '13 the gap is routinely large. The range inherits that error entirely.',
    );
  }

  return {
    status: 'range',
    range: {
      low: round(appliedTo * published.low),
      high: round(appliedTo * published.high),
      lowPercent: published.low,
      highPercent: published.high,
      denominator: band.denominator!,
      appliedTo,
      appliedToLabel,
      derivation,
      caveats,
    },
  };
}
