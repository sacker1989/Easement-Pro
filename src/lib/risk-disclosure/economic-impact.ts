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

export interface DataCoverageFacts {
  isLaCounty: boolean;
  /** Present only when a live assessor lookup actually returned a record. */
  assessorValuation?: AssessorParcelValuation;
  /** True when the price was modelled forward by the house-price index. */
  marketIndexed?: boolean;
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
      // modelled figure must not be asserted that way.
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
          'index. The result is a modelled estimate assuming county-median appreciation, ' +
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
  varianceBand: 0.2, // +/-20%, reflected in the low/high range
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
}

/**
 * Which source supplied the per-sq-ft figure, in precedence order.
 *
 * 'national-benchmark' IS GONE from this union, which is the type-level half
 * of the fix: there is no longer a way to resolve a land value from nothing,
 * so no later edit can reintroduce one without adding a variant here and
 * saying where it came from.
 */
type PriceSource = 'caller-override' | 'market-indexed' | 'assessor-roll';

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
  'average for one. Land prices vary by more than an order of magnitude between neighbourhoods, ' +
  'so a single national figure would not tell you the scale of anything. Your county assessor ' +
  'publishes an assessed land value — that is the number this needs.';

export function buildEconomicImpactEstimate(inputs: EconomicImpactInputs): EconomicImpactEstimate {
  const resolved = resolvePricePerSqFt(inputs);
  const adjustment = resolved?.adjustment;
  const lostBuildableAreaSqFt = inputs.easementAreaSqFt;
  const constructionCost = resolveConstructionCost(inputs.state);
  const reworkCostCenter = lostBuildableAreaSqFt * constructionCost.costPerSqFt;
  const dataCoverage = classifyDataCoverage({
    isLaCounty: inputs.isLaCounty,
    assessorValuation: inputs.assessorValuation,
    marketIndexed: resolved?.source === 'market-indexed',
  });

  /*
   * REWORK COST SURVIVES A MISSING LAND VALUE, because it does not depend on
   * one: it is an area times a regional construction median from the Census
   * Survey of Construction. Only the value-at-risk figure needed land.
   */
  const valueAtRisk: ValueAtRisk =
    resolved === null
      ? { status: 'unavailable', reason: NO_LAND_VALUE_REASON }
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
            : `an assessed land value of $${displayPrice}/sq ft`,
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
      : `Value at risk multiplies that area by ${priceSourceNote}, shown as a range of ` +
        `±${variancePercent}% to reflect estimate uncertainty.`;

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
