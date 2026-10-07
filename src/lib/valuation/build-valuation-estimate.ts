/**
 * The IRWA valuation engine, assembled for a homeowner.
 *
 * WHAT THIS CLOSES. `calculator.ts` and `valuation-matrix.ts` implement the
 * dual-method easement valuation and were imported by exactly one thing: the
 * professional handoff package. Nothing a homeowner could see used them. The
 * report showed only the lighter screening estimate, so "identify easement
 * valuation" — half the product's pitch — was delivered to appraisers and not
 * to the people the product is for.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES NOT DO, STATED FIRST BECAUSE IT IS THE PART THAT MATTERS
 * ────────────────────────────────────────────────────────────────────────
 *
 * Wiring IRWA upgrades the METHOD AND ITS PRESENTATION. It does not upgrade
 * the underlying numbers, and it does not make the output defensible against
 * Uniform Appraisal Standards §4.6.5, which rejects percentage-of-fee
 * valuation outright.
 *
 * The Summation figure is land value × an impact percentage. Those percentages
 * are `IMPACT_TIERS`, which are the same uncited bands tracked as
 * SCREENING-BANDS-UNCITED and accepted as a risk on 2026-08-22. A reader who
 * sees "IRWA Summation Method" and concludes the number is now appraisal-grade
 * has been misled, so the output says otherwise in its own words rather than
 * relying on a banner elsewhere on the page.
 *
 * ────────────────────────────────────────────────────────────────────────
 * THREE DECISIONS WORTH DEFENDING
 * ────────────────────────────────────────────────────────────────────────
 *
 * 1. IT REFUSES EXACTLY WHERE THE SCREENING ESTIMATE REFUSES, by reading that
 *    module's own refusal text rather than re-deciding. Conservation,
 *    pipeline, slope and prescriptive are refused there for reasons that do
 *    not stop being true because a different method is applied — and a report
 *    showing "no estimate is possible" beside "here is an estimate" would be
 *    worse than either alone. One source of truth, quoted.
 *
 * 2. BEFORE-AND-AFTER IS NOT COMPUTED FROM OUR OWN ASSUMPTIONS. It needs an
 *    appraised value of the remainder AFTER the easement — an opinion this
 *    product cannot form. Deriving that figure from the same impact
 *    percentage the Summation uses would produce two methods that agree
 *    because one is algebraically the other, and false corroboration is worse
 *    than a single honest number. So it runs only when a real appraised figure
 *    is supplied, and otherwise reports precisely which input is missing.
 *
 * 3. A RANGE, FROM THE TIER'S OWN BOUNDS. `resolveImpactPercentage` returns a
 *    tier midpoint, which would give a single confident-looking number. The
 *    tiers are bands, so the estimate is run at both ends. Same reason
 *    `screening-estimate.ts` has no `pointEstimate` field.
 */

import type { EasementType } from '@/lib/easements/easement-types';
import { EasementValuationCalculator, type SummationResult } from './calculator';
import { IMPACT_TIERS, type ImpactTier } from './valuation-matrix';
import { SCREENING_BAND_BY_TYPE } from './screening-estimate';

/**
 * Which IRWA impact tier each easement type falls in.
 *
 * READ OFF THE TIERS' OWN DESCRIPTIONS wherever they name a kind of easement,
 * which is most of them — `severe` names "overhead electric", `balanced` names
 * "sewer/water lines 50/50 split", `moderate_low` names "water/sewer, cable,
 * telecom" along a property line, `major` names "drainage, flowage". That
 * makes the mapping a reading of the matrix rather than a judgement layered on
 * top of it, which is the difference between citing a source and inventing one.
 *
 * THE TWO ACCESS TYPES ARE NOT NAMED BY ANY TIER, and that absence is real
 * rather than an oversight in this table — see `WHOLE_PARCEL_TYPES` below for
 * what is done about it.
 */
export const IMPACT_TIER_BY_TYPE = {
  // "Severe impact on surface use… e.g., overhead electric"
  'utility-overhead': 'severe',
  // "Location along property line/setback, minor utility… cable, telecom"
  'utility-underground': 'moderate_low',
  // "Balanced use by owner and holder (e.g., sewer/water lines 50/50 split)"
  sewer: 'balanced',
  'water-line': 'balanced',
  // "Major impact… e.g., pipelines, drainage, flowage"
  drainage: 'major',
  'storm-drain': 'major',
  // Named by no tier. Estimated on the strip only; see WHOLE_PARCEL_TYPES.
  'access-ingress-egress': 'moderate_high',
  'public-right-of-way': 'moderate_high',
  // Refused before the tier is ever read. Present so the record is exhaustive
  // and a new easement type is a compile error here rather than a silent gap.
  conservation: 'severe',
  pipeline: 'major',
  slope: 'moderate_low',
  prescriptive: 'moderate_high',
} as const satisfies Record<EasementType, keyof typeof IMPACT_TIERS>;

/**
 * Types whose real effect is on the WHOLE parcel rather than on a strip.
 *
 * The Summation method is "value of the part acquired PLUS damages to the
 * remainder". This product can compute the first term and has no basis for the
 * second — damages to the remainder are an appraiser's judgement about what
 * the burden does to the rest of the land.
 *
 * For a buried utility along a boundary that omission is small. For a driveway
 * easement across the front of a lot it is most of the answer, and
 * `screening-estimate.ts` reflects that by denominating access against TOTAL
 * property value rather than the strip. So these types still get a figure —
 * the part acquired, which is real — carrying an explicit statement that the
 * larger number is the one not shown.
 */
export const WHOLE_PARCEL_TYPES: ReadonlySet<EasementType> = new Set([
  'access-ingress-egress',
  'public-right-of-way',
]);

export interface ValuationEstimateInputs {
  readonly easementType: EasementType;
  /** County geometry where available, the user's figure otherwise. */
  readonly lotAreaSqFt: number | null;
  readonly easementAreaSqFt: number | null;
  readonly landValuePerSqFt: number | null;
  /** Where the value came from, carried into the output verbatim. */
  readonly valueSource: string;
  /**
   * An appraiser's opinion of the land's value per sq ft AFTER the easement.
   *
   * The only input that unlocks Before-and-After. Null is the normal case and
   * is not a gap to be filled with an assumption — see decision 2.
   */
  readonly appraisedRemainderValuePerSqFt?: number | null;
}

export interface ValuationBound {
  readonly impactPercent: number;
  readonly result: SummationResult;
}

export type BeforeAndAfterOutcome =
  | { readonly kind: 'computed'; readonly totalCompensation: number; readonly remainderValuePerSqFt: number }
  | { readonly kind: 'needs-appraiser'; readonly missingInput: string; readonly whyNotDerived: string };

export type ValuationEstimate =
  | {
      readonly kind: 'refused';
      readonly easementType: EasementType;
      /** The screening module's own words. Not re-decided here. */
      readonly reason: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly easementType: EasementType;
      readonly reason: string;
    }
  | {
      readonly kind: 'estimated';
      readonly easementType: EasementType;
      readonly tier: ImpactTier;
      readonly low: ValuationBound;
      readonly high: ValuationBound;
      readonly beforeAndAfter: BeforeAndAfterOutcome;
      /** True when the figure covers the strip and not the whole-parcel effect. */
      readonly stripOnly: boolean;
      readonly valueSource: string;
      readonly methodDisclosure: string;
    };

/** Stated wherever an IRWA figure appears. */
export const IRWA_METHOD_DISCLOSURE =
  'This applies the IRWA Summation Method: the value of the part acquired, taken as a percentage ' +
  'of the land value of the easement area. The percentages come from a published impact matrix ' +
  'that this product has not been able to verify against its original source, and the Uniform ' +
  'Appraisal Standards for Federal Land Acquisitions §4.6.5 rejects percentage-of-fee valuation ' +
  'for exactly this reason. Naming the method does not make the number an appraisal. It is an ' +
  'order-of-magnitude figure for deciding whether this is worth a professional’s time.';

export const STRIP_ONLY_WARNING =
  'This figure values the easement strip only. For an access easement the larger loss is usually ' +
  'what the burden does to the REST of the parcel — where you can build, how the lot is used, what ' +
  'a buyer will pay — and that is a judgement an appraiser makes about your specific property. It ' +
  'is not included below, and for this kind of easement it is often the bigger number.';

const B_AND_A_NOT_DERIVED =
  'The Before-and-After method needs an appraised value of the land AFTER the easement. Deriving ' +
  'that from the same impact percentage used above would produce two methods that agree only ' +
  'because one is the arithmetic of the other, which reads as corroboration and is not. Supply a ' +
  'real appraised figure and it will run.';

function summationAt(
  calc: EasementValuationCalculator,
  easementAreaSqFt: number,
  tierKey: keyof typeof IMPACT_TIERS,
  percent: number,
): ValuationBound {
  return {
    impactPercent: percent,
    result: calc.summationMethod(easementAreaSqFt, tierKey, 0, percent),
  };
}

/**
 * Builds the homeowner-facing valuation estimate.
 *
 * Returns a discriminated result rather than throwing. Every refusal reason
 * here is a normal condition — an unknown lot area, a type with no defensible
 * band — and a page that has to try/catch to render a section will eventually
 * render nothing instead.
 */
export function buildValuationEstimate(inputs: ValuationEstimateInputs): ValuationEstimate {
  const { easementType } = inputs;

  /*
   * REFUSALS COME FIRST, AND FROM THE OTHER MODULE. Checking this before
   * anything else means no code path can produce an IRWA figure for a type the
   * screening estimate refuses, however the inputs are shaped.
   */
  const band = SCREENING_BAND_BY_TYPE[easementType];
  if ('refusal' in band && band.refusal !== undefined) {
    return { kind: 'refused', easementType, reason: band.refusal };
  }

  const lotAreaSqFt = inputs.lotAreaSqFt;
  const easementAreaSqFt = inputs.easementAreaSqFt;
  const landValuePerSqFt = inputs.landValuePerSqFt;

  if (lotAreaSqFt === null || lotAreaSqFt <= 0) {
    return {
      kind: 'unavailable',
      easementType,
      reason: 'No parcel area is available, and the method works from the land area outward.',
    };
  }
  if (landValuePerSqFt === null || landValuePerSqFt <= 0) {
    return {
      kind: 'unavailable',
      easementType,
      reason:
        'No assessed land value is available for this parcel, so there is nothing to take a ' +
        'percentage of.',
    };
  }
  if (easementAreaSqFt === null || easementAreaSqFt <= 0) {
    return {
      kind: 'unavailable',
      easementType,
      reason: 'No easement area was supplied or derived, and the method prices an area.',
    };
  }
  if (easementAreaSqFt > lotAreaSqFt) {
    /*
     * The calculator throws on this, and it is a reachable user input rather
     * than a programmer error: the form takes both figures from the homeowner
     * when no county geometry matched. Caught here so it reads as a question
     * about their numbers instead of a crash.
     */
    return {
      kind: 'unavailable',
      easementType,
      reason:
        `The easement area given (${Math.round(easementAreaSqFt).toLocaleString()} sq ft) is larger ` +
        `than the lot (${Math.round(lotAreaSqFt).toLocaleString()} sq ft). One of the two is wrong, ` +
        'and no estimate is offered until they agree.',
    };
  }

  const tierKey = IMPACT_TIER_BY_TYPE[easementType];
  const tier = IMPACT_TIERS[tierKey]!;
  const calc = new EasementValuationCalculator(lotAreaSqFt, 'sq ft', landValuePerSqFt);

  const appraised = inputs.appraisedRemainderValuePerSqFt;
  const beforeAndAfter: BeforeAndAfterOutcome =
    typeof appraised === 'number' && Number.isFinite(appraised) && appraised >= 0
      ? {
          kind: 'computed',
          remainderValuePerSqFt: appraised,
          totalCompensation: calc.beforeAndAfterMethod(
            easementAreaSqFt,
            appraised,
            tierKey,
          ).totalCompensation,
        }
      : {
          kind: 'needs-appraiser',
          missingInput: 'An appraised value per square foot for the land after the easement.',
          whyNotDerived: B_AND_A_NOT_DERIVED,
        };

  return {
    kind: 'estimated',
    easementType,
    tier,
    low: summationAt(calc, easementAreaSqFt, tierKey, tier.lowPercent),
    high: summationAt(calc, easementAreaSqFt, tierKey, tier.highPercent),
    beforeAndAfter,
    stripOnly: WHOLE_PARCEL_TYPES.has(easementType),
    valueSource: inputs.valueSource,
    methodDisclosure: IRWA_METHOD_DISCLOSURE,
  };
}
