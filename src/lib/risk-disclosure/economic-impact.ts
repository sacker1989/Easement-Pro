import { classifyByRules, type ConfidenceRule, type TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import type { AssessorParcelValuation } from './la-county-assessor-provider';
import { marketAdjustParcel, type MarketAdjustedParcel } from './market-index';
import { resolveConstructionCost, type ConstructionCostEstimate } from './construction-cost';

/**
 * Track 3 economic-impact panel: lost buildable area, value range at risk,
 * and rework cost, plus a data-coverage confidence label. Per
 * docs/development-strategy-v2.md: "reuse the existing Clear / Likely /
 * Flagged confidence pattern rather than building separate geographic
 * gating logic" — the label is the only thing that changes by location,
 * never feature availability, so this module never blocks on state/county.
 *
 * The coverage label keys on whether real assessor data actually backs the
 * figures, NOT on which county the address is in. An earlier revision graded
 * any LA County address as "Verified against LA County reference data" even
 * when every dollar shown came from the invented national placeholder — the
 * label asserted verification that had not occurred.
 */

export interface DataCoverageLabel {
  label: string;
}

/**
 * States whose assessment roll is a statutory FRACTION of market value.
 *
 * WHY THIS IS NOT THE SAME CAVEAT AS STALENESS. The existing county caveat
 * says an assessed value "is an assessment rather than an appraisal" and that
 * how closely it tracks market value "cannot be read off the roll". For
 * California that is the whole story: Proposition 13 assesses at market as of
 * the base year, so the figure was a market value once and may now be stale.
 *
 * Illinois is a different relationship. Cook County publishes a fraction of
 * market value BY DESIGN, in the current year, so the figure was never the
 * number a homeowner wants. Telling an Illinois reader their value "may be
 * stale" describes the wrong problem and understates it by about an order of
 * magnitude.
 *
 * MEASURED 2026-10-15, from the county's own layer rather than from statute.
 * Median published CURRENTVALUE_TOTAL for residential parcels with a building
 * over 400 sq ft, 200 parcels each:
 *
 *   Sauk Village   $8,508      Chicago    $12,700
 *   Evanston      $42,001      Winnetka  $250,584
 *
 * A median of $42,001 for an Evanston house, or $9,267 for a 1,376 sq ft
 * frame-and-masonry house in Sauk Village, is not a market price. The reader
 * can see that for themselves from the panel, which is why the wording points
 * at the county's own total rather than asserting a ratio.
 *
 * NO RATIO IS APPLIED. Scaling the figure would need a cited assessment level
 * — the Illinois Department of Revenue's annual assessment/sales ratio study
 * is the right source and is not wired. Until it is, the product says what
 * the figure is and what it is not, and declines to convert it. Writing a
 * ratio from memory into a number that prices someone's property is exactly
 * what the deleted national $220/sq ft was.
 */
const FRACTIONAL_ASSESSMENT_STATES: Readonly<Record<string, string>> = {
  IL:
    'Illinois assesses property at a statutory fraction of market value rather than at it, so ' +
    'the figures below are a fraction of what the land would sell for — not an estimate of it, ' +
    'and not merely an out-of-date one. You can see this on the parcel panel above: the total ' +
    'value the county publishes for the whole property is far below any price it would fetch. ' +
    'This tool does not scale the figure up, because the conversion needs the state’s published ' +
    'assessment-to-sales ratio and inventing one would be worse than declining. Treat the ' +
    'dollar amounts here as a floor, and read the percentage band as the useful part.',
};

/** The extra sentence a fractional-assessment state needs, or null. */
export function fractionalAssessmentCaveat(state: string | undefined): string | null {
  return FRACTIONAL_ASSESSMENT_STATES[String(state ?? '').toUpperCase()] ?? null;
}

export interface DataCoverageFacts {
  isLaCounty: boolean;
  /**
   * Two-letter state code, read only to tell a fractional-assessment roll
   * from a market-at-base-year one. See FRACTIONAL_ASSESSMENT_STATES.
   */
  state?: string;
  /** Present only when a live assessor lookup actually returned a record. */
  assessorValuation?: AssessorParcelValuation;
  /** True when the price was modeled forward by the house-price index. */
  marketIndexed?: boolean;
  /**
   * A county that is not LA, whose own assessor roll supplied the land value.
   *
   * ADDED BECAUSE THE RULES ONLY KNEW ABOUT LA. Orange, San Diego and Cook
   * all publish an assessed land value, the report renders it in the parcel
   * panel, and every one of them still fell through to the
   * national-estimate-default rule — so a page showing a real county figure
   * was labeled "Based on national estimates, not locally verified".
   */
  countyLandValue?: { readonly county: string; readonly perSqFt: number };
}

const DATA_COVERAGE_RULES: ReadonlyArray<ConfidenceRule<DataCoverageFacts, DataCoverageLabel>> = [
  {
    id: 'la-county-market-indexed',
    // Data provenance, not law. Needs no state rule set.
    claimType: 'observation' as const,
    evaluate(facts) {
      const v = facts.assessorValuation;
      if (!v || !facts.marketIndexed) return null;
      // The parcel identity and lot area are verified, but the price is a
      // model output. 'clear' gates direct assertion in a paid letter, and a
      // modeled figure must not be asserted that way.
      return {
        tier: 'likely-with-caveat',
        value: {
          label:
            `LA County parcel ${v.ain}, assessed value indexed forward from its ` +
            `${v.landBaseYear} base year to current market`,
        },
        caveat:
          'The county assessment reflects a Proposition 13 base year rather than current ' +
          'market value, so it has been indexed forward using the LA County house-price ' +
          'index. The result is a modeled estimate assuming county-median appreciation, ' +
          'not an appraisal or an observed sale price.',
      };
    },
  },
  {
    id: 'la-county-assessor-verified',
    // Data provenance, not law. Needs no state rule set.
    claimType: 'observation' as const,
    evaluate(facts) {
      const v = facts.assessorValuation;
      if (!v) return null;
      return {
        tier: 'clear',
        value: {
          label:
            `Verified against the LA County ${v.rollYear} assessment roll ` +
            `(AIN ${v.ain}, land value $${v.landValuePerSqFt.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}/sq ft)`,
        },
      };
    },
  },
  {
    id: 'la-county-assessor-unavailable',
    // Data provenance, not law. Needs no state rule set.
    claimType: 'observation' as const,
    evaluate(facts) {
      if (!facts.isLaCounty) return null;
      return {
        tier: 'likely-with-caveat',
        value: { label: 'LA County parcel, but assessor data was not retrieved' },
        caveat:
          'This address is in LA County, where assessor roll values are available, but no ' +
          'parcel record was retrieved for it. The figures below fall back to national ' +
          'benchmarks and are not verified against county data.',
      };
    },
  },
  {
    /*
     * ORDERED AFTER THE LA RULES AND BEFORE THE DEFAULT, which is the whole
     * of its behavior: classifyByRules is first-match-wins, so this catches
     * the three counties that publish a land value and are not LA, and lets
     * everywhere else fall through to the national default as before.
     */
    id: 'county-assessor-verified',
    // Data provenance, not law. Needs no state rule set.
    claimType: 'observation' as const,
    evaluate(facts) {
      const v = facts.countyLandValue;
      if (!v) return null;
      /*
       * likely-with-caveat, NOT clear, and the difference is deliberate.
       * 'clear' gates direct assertion in a paid letter. These counties
       * publish no Proposition 13 base year, so there is no way to tell from
       * the roll whether a figure is current or decades stale — the caveat
       * that already travels with the valuation says so per county. An
       * unknown vintage is not a verified price.
       */
      const perSqFt = v.perSqFt.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const fractional = fractionalAssessmentCaveat(facts.state);
      return {
        tier: 'likely-with-caveat',
        value: {
          /*
           * "VERIFIED ... (LAND VALUE $0.35/SQ FT)" WAS WRONG FOR ILLINOIS and
           * shipped that way. Verified is true of the provenance and false of
           * the quantity: $0.35/sq ft is a tenth-ish of a land price, and a
           * label reading "verified land value" invites a reader to treat it
           * as one. The word stays where the roll is a market figure and the
           * label says "assessed" where it is a statutory fraction.
           */
          label: fractional
            ? `From the ${v.county} assessment roll — an assessed figure, ` +
              `$${perSqFt}/sq ft, which is a fraction of market value`
            : `Verified against the ${v.county} assessment roll (land value $${perSqFt}/sq ft)`,
        },
        caveat:
          'This is the county’s own assessed land value for your parcel, not a national ' +
          'average. It is an assessment rather than an appraisal, and this county publishes no ' +
          'base year with it, so how closely it tracks current market value cannot be read off ' +
          'the roll.' +
          // The sentence that travels with the figure for a fractional state.
          (fractional ? ` ${fractional}` : ''),
      };
    },
  },
  {
    id: 'national-estimate-default',
    // Data provenance, not law. Needs no state rule set.
    claimType: 'observation' as const,
    evaluate() {
      return {
        tier: 'likely-with-caveat',
        value: { label: 'Based on national estimates, not locally verified' },
        /*
         * THIS CAVEAT USED TO CITE "national FHFA/NAHB-style benchmarks" for a
         * number with no source at all — see the deleted medianPricePerSqFt
         * below. Neither agency publishes a national median land value per
         * square foot, and "-style" does not rescue a sentence that puts two
         * federal and industry acronyms behind an invented figure. It is gone,
         * along with the figure.
         *
         * What remains here is sourced and says which part it covers: the
         * rework estimate is a real regional median, and no land value means
         * no value-at-risk rather than a national stand-in.
         */
        caveat:
          'No county land value was available for this address, so no value-at-risk figure is ' +
          'offered — this tool does not substitute a national average for a land value it does ' +
          'not have. The rework estimate below is a regional Census/NAHB median, not a figure ' +
          'for your parcel.',
      };
    },
  },
];

// The national-estimate-default rule above always matches when neither LA County
// rule applies, so classifyByRules should never actually reach this fallback.
const UNREACHABLE_FALLBACK = {
  tier: 'flagged-ambiguous',
  flagReason: 'No data-coverage rule matched — this should be unreachable.',
} as const;

export function classifyDataCoverage(facts: DataCoverageFacts): TieredResult<DataCoverageLabel> {
  return classifyByRules(facts, DATA_COVERAGE_RULES, UNREACHABLE_FALLBACK);
}

function dataCoverageLabelText(result: TieredResult<DataCoverageLabel>): string {
  return result.tier === 'flagged-ambiguous' ? 'Data coverage could not be determined.' : result.value.label;
}

/**
 * What is left of the national fallbacks.
 *
 * `medianPricePerSqFt: 220` WAS HERE AND IS DELETED, not merely unused. Its
 * own comment called it "an unsourced placeholder ... a national land-value
 * feed that is not wired up", and it was nevertheless multiplied by the
 * easement area to produce a "Value at risk" range for every visitor outside
 * the four covered counties — which is most of them. The report then told
 * those readers the figure came from "national FHFA/NAHB-style benchmarks".
 *
 * IT WAS WRONG BY ORDERS OF MAGNITUDE IN BOTH DIRECTIONS. Land is not $220/sq
 * ft everywhere; one constant cannot span a Bay Area infill lot and a rural
 * parcel, and the ±20% band around it implied a precision that made the guess
 * look measured.
 *
 * THE PRODUCT ALREADY KNEW BETTER TEN LINES AWAY. `screening-estimate.ts`
 * refuses in exactly this situation — "this tool does not assume a default
 * width or a default land value" — and the two sections rendered on the same
 * page, one refusing and one substituting. Deleting the constant is what makes
 * the two agree; leaving it unused would have left it there to be picked up
 * again.
 *
 * reworkCostPerSqFt was removed earlier. Rework pricing resolves per region
 * from Census Survey of Construction data, which is a real source — see
 * construction-cost.ts.
 */
export const NATIONAL_ECONOMIC_BENCHMARKS = {
  /*
   * A PRESENTATIONAL BAND, NOT A MEASURED ONE, and the only figure in this
   * module left without a source after the sweep that removed the $220.
   *
   * It is a round 20% that nobody calibrated. That is defensible as a way of
   * refusing to print a single number — a band invites less reliance than a
   * point estimate, which is the same reasoning the screening range rests on
   * — but it is NOT a confidence interval, and there is no distribution
   * behind it. The methodology string used to call it a range "to reflect
   * estimate uncertainty", which claimed the uncertainty had been estimated.
   * It had not. The copy now says what it is.
   *
   * It would become a real interval given a distribution of assessed-to-sale
   * ratios for the county in question. Nothing in the product has one.
   */
  varianceBand: 0.2,
  needsLiveDataSourceIntegration: true as const,
};

export interface EconomicImpactInputs {
  lotAreaSqFt: number;
  easementAreaSqFt: number;
  isLaCounty: boolean;
  /** Optional local price/sq ft, when a caller has better data than the national default. */
  pricePerSqFtOverride?: number;
  /**
   * Live LA County assessor record, when one was retrieved. Supplies the
   * per-sq-ft land value and upgrades the coverage label to verified.
   */
  assessorValuation?: AssessorParcelValuation;
  /**
   * Set false to price off the raw assessed value instead of indexing it
   * forward. Defaults to indexing, since the raw figure is known to be stale.
   */
  applyMarketIndex?: boolean;
  /**
   * Two-letter state code, used to pick a regional construction cost for the
   * rework estimate. Falls back to the national median when omitted.
   */
  state?: string;
  /**
   * Land value from a non-LA county assessor roll.
   *
   * SEPARATE FROM assessorValuation BECAUSE THAT TYPE IS LA-SHAPED — it
   * carries an AIN and a Proposition 13 base year, neither of which Orange,
   * San Diego or Cook publish. Flattening them into it would mean inventing
   * the fields they do not have, which is the opposite of what the unified
   * county shape exists to prevent.
   */
  countyLandValue?: { readonly county: string; readonly perSqFt: number };
  /**
   * Why no price could be resolved, when the caller already knows.
   *
   * THE RESOLVER CANNOT WORK THIS OUT FOR ITSELF. A condominium unit arrives
   * carrying a perfectly positive land value and a lot area that is simply
   * not the owner's, which is indistinguishable here from any other parcel.
   * The caller holds the tenure; this is how it states that fact without
   * composing prose, which this module owns so the two cannot drift.
   */
  noPriceReason?: NoPriceReason;
}

/**
 * Which source supplied the per-sq-ft figure, in precedence order.
 *
 * 'national-benchmark' IS GONE from this union, which is the type-level half
 * of the fix: there is no longer a way to resolve a land value from nothing,
 * so no later edit can reintroduce one without adding a variant here and
 * saying where it came from.
 */
type PriceSource = 'caller-override' | 'market-indexed' | 'assessor-roll' | 'county-assessor';

interface ResolvedPrice {
  price: number;
  source: PriceSource;
  adjustment?: MarketAdjustedParcel;
}

/**
 * Market indexing is preferred over the raw assessed value because a Prop 13
 * assessment reflects its base year, not the market — see market-index.ts.
 * The raw figure is used only when the record carries no usable base year.
 */
/**
 * Returns null when no real land value is available, rather than inventing
 * one. Every caller must handle that, which is the point.
 */
function resolvePricePerSqFt(inputs: EconomicImpactInputs): ResolvedPrice | null {
  /*
   * A NON-POSITIVE PRICE IS NOT A PRICE, whichever branch produced it.
   *
   * CAUGHT BEFORE SHIPPING, BUT ONLY JUST. Suppressing the per-sq-ft figure
   * for a condominium unit sets landValuePerSqFt to 0, and the assessorValuation
   * branch below returns whatever it finds without checking the sign — via
   * marketAdjustParcel, which happily indexes 0 forward to 0. The result would
   * have been status 'range' with a band around $0: "your easement is worth
   * $0 to $0", which is a far more confident claim than "no estimate is
   * possible" and is the opposite of what the suppression was for.
   *
   * Guarding at the exit rather than in each branch means a future source
   * cannot reintroduce it by returning a zero of its own.
   */
  const resolved = resolvePricePerSqFtUnchecked(inputs);
  return resolved !== null && Number.isFinite(resolved.price) && resolved.price > 0
    ? resolved
    : null;
}

function resolvePricePerSqFtUnchecked(inputs: EconomicImpactInputs): ResolvedPrice | null {
  if (inputs.pricePerSqFtOverride !== undefined) {
    return { price: inputs.pricePerSqFtOverride, source: 'caller-override' };
  }

  if (inputs.assessorValuation) {
    const valuation = inputs.assessorValuation;
    if (inputs.applyMarketIndex !== false) {
      const adjustment = marketAdjustParcel(valuation, valuation.landBaseYear);
      if (adjustment) {
        return { price: adjustment.marketLandValuePerSqFt, source: 'market-indexed', adjustment };
      }
    }
    return { price: valuation.landValuePerSqFt, source: 'assessor-roll' };
  }

  /*
   * THE OTHER THREE COUNTIES. `assessorValuation` above is the LA-shaped
   * record, so Orange, San Diego and Cook never reached it — their land
   * value was read, rendered in the parcel panel, and then dropped on the
   * floor here. Before 2026-10-11 that meant the invented national $220 was
   * used instead of a figure the county had published; after the $220 was
   * deleted it meant the report said "No land value is published for this
   * address" directly beneath a panel displaying the published land value.
   * Both were wrong, and the second was wrong in a way a reader could see.
   */
  if (inputs.countyLandValue) {
    return { price: inputs.countyLandValue.perSqFt, source: 'county-assessor' };
  }

  return null;
}

export interface DollarRange {
  low: number;
  high: number;
  currency: 'USD';
}

/**
 * What the encumbered land is worth, or why that cannot be said.
 *
 * A UNION RATHER THAN A NULLABLE RANGE, so the renderer cannot quietly drop
 * the section and leave the reader wondering. When there is no land value the
 * honest output is a sentence explaining that, in the place the number would
 * have been — the same shape `screening-estimate.ts` uses for the same
 * situation.
 */
export type ValueAtRisk =
  | { readonly status: 'range'; readonly range: DollarRange }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface EconomicImpactEstimate {
  lostBuildableAreaSqFt: number;
  valueAtRisk: ValueAtRisk;
  reworkCostRange: DollarRange;
  methodology: string;
  dataCoverage: TieredResult<DataCoverageLabel>;
  /** Present when the assessed value was indexed forward to current market. */
  marketAdjustment?: MarketAdjustedParcel;
  /** Which construction-cost figure backed the rework range. */
  constructionCost: ConstructionCostEstimate;
}

function dollarRange(center: number, variance: number): DollarRange {
  return {
    low: Math.round(center * (1 - variance)),
    high: Math.round(center * (1 + variance)),
    currency: 'USD',
  };
}

/** Said in place of the figure, so the gap is explained rather than blank. */
const NO_LAND_VALUE_REASON =
  'No land value is published for this address, and this tool does not substitute a national ' +
  'average for one. Land prices vary by more than an order of magnitude between neighborhoods, ' +
  'so a single national figure would not tell you the scale of anything. Your county assessor ' +
  'publishes an assessed land value — that is the number this needs.';

/**
 * The same refusal, for the opposite reason.
 *
 * NO_LAND_VALUE_REASON IS FALSE FOR A CONDOMINIUM AND SHIPPED THAT WAY FOR AN
 * HOUR. It says no land value is published and tells the reader to get one
 * from their assessor. For a unit in a common-interest development the county
 * publishes a land value, the report displays it in the panel immediately
 * above — $467,827 for the Irvine case — and what is missing is a lot area
 * belonging to that owner alone. Sending them to the assessor for a figure
 * the assessor already published, and that they can see on the page, is the
 * same mistake as describing a city department as "the county": it is
 * confidently wrong about who to ask.
 *
 * The module owns both sentences so the caller states a fact rather than
 * composing prose, and so the two cannot drift apart.
 */
const UNDIVIDED_INTEREST_REASON =
  'A dollar range is not estimated for this parcel, and the reason is not missing data. The ' +
  'county publishes a land value for this unit and a lot area for the whole development, and ' +
  'those two numbers cannot be divided into a price per square foot — every unit in the project ' +
  'carries the same lot area, so the result would be understated by roughly the number of units. ' +
  'Nor is your fractional share simply multiplied back out: an easement over common area ' +
  'burdens the development rather than your unit, and what you are owed for it is governed by ' +
  'the recorded declaration and the CC&Rs, not by arithmetic on the assessment roll. Those ' +
  'documents, and your association, are where this question is actually answered.';

/** Why no price per square foot could be resolved. */
export type NoPriceReason =
  /** The county publishes no land value at all. */
  | 'not-published'
  /** It publishes one, against a lot this owner shares. See LotTenure. */
  | 'undivided-interest';

export function buildEconomicImpactEstimate(inputs: EconomicImpactInputs): EconomicImpactEstimate {
  const resolved = resolvePricePerSqFt(inputs);
  const adjustment = resolved?.adjustment;
  const lostBuildableAreaSqFt = inputs.easementAreaSqFt;
  const constructionCost = resolveConstructionCost(inputs.state);
  const reworkCostCenter = lostBuildableAreaSqFt * constructionCost.costPerSqFt;
  const dataCoverage = classifyDataCoverage({
    isLaCounty: inputs.isLaCounty,
    state: inputs.state,
    assessorValuation: inputs.assessorValuation,
    marketIndexed: resolved?.source === 'market-indexed',
    countyLandValue: inputs.countyLandValue,
  });

  /*
   * REWORK COST SURVIVES A MISSING LAND VALUE, because it does not depend on
   * one: it is an area times a regional construction median from the Census
   * Survey of Construction. Only the value-at-risk figure needed land.
   */
  const valueAtRisk: ValueAtRisk =
    resolved === null
      ? {
          status: 'unavailable',
          reason:
            inputs.noPriceReason === 'undivided-interest'
              ? UNDIVIDED_INTEREST_REASON
              : NO_LAND_VALUE_REASON,
        }
      : {
          status: 'range',
          range: dollarRange(
            lostBuildableAreaSqFt * resolved.price,
            NATIONAL_ECONOMIC_BENCHMARKS.varianceBand,
          ),
        };

  // Show cents when the source value has them, so the stated price matches the
  // one actually multiplied rather than a rounded approximation of it.
  const displayPrice =
    resolved === null
      ? ''
      : Number.isInteger(resolved.price)
        ? resolved.price.toLocaleString()
        : resolved.price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
  const priceSourceNote =
    resolved === null
      ? null
      : {
          'caller-override': `a supplied local price of $${displayPrice}/sq ft`,
          'market-indexed': `a market-indexed land value of $${displayPrice}/sq ft for this parcel`,
          'assessor-roll': inputs.assessorValuation
            ? `the LA County ${inputs.assessorValuation.rollYear} assessed land value of ` +
              `$${displayPrice}/sq ft for this parcel`
            : `an assessed land value of ${displayPrice}/sq ft`,
          'county-assessor': inputs.countyLandValue
            ? `the ${inputs.countyLandValue.county} assessed land value of ` +
              `${displayPrice}/sq ft for this parcel`
            : `a county assessed land value of ${displayPrice}/sq ft`,
        }[resolved.source];
  const variancePercent = Math.round(NATIONAL_ECONOMIC_BENCHMARKS.varianceBand * 100);

  /*
   * The methodology describes what was actually done. When no value at risk
   * was produced it says so rather than describing a multiplication that did
   * not happen — the old string always claimed one, which is how the invented
   * price got narrated to the reader as a method.
   */
  const valueAtRiskSentence =
    priceSourceNote === null
      ? 'No value at risk is given, because no land value was available for this address.'
      : `Value at risk multiplies that area by ${priceSourceNote}, shown as a fixed ` +
        `±${variancePercent}% band rather than a single number. That band is a deliberate ` +
        'refusal to state a point figure, not a calculated margin of error.';

  const methodology =
    `Lost buildable area is the easement's footprint: ${Math.round(lostBuildableAreaSqFt).toLocaleString()} sq ft ` +
    `out of a ${Math.round(inputs.lotAreaSqFt).toLocaleString()} sq ft lot. ${valueAtRiskSentence} ` +
    `${constructionCost.note} The same variance band applies. ` +
    `${dataCoverageLabelText(dataCoverage)}.` +
    (adjustment ? ` ${adjustment.note}` : '');

  return {
    lostBuildableAreaSqFt,
    valueAtRisk,
    reworkCostRange: dollarRange(reworkCostCenter, NATIONAL_ECONOMIC_BENCHMARKS.varianceBand),
    methodology,
    dataCoverage,
    constructionCost,
    ...(adjustment ? { marketAdjustment: adjustment } : {}),
  };
}
