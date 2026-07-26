import { classifyByRules, type ConfidenceRule, type TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import type { AssessorParcelValuation } from './la-county-assessor-provider';
import { marketAdjustParcel, type MarketAdjustedParcel } from './market-index';

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
    evaluate() {
      return {
        tier: 'likely-with-caveat',
        value: { label: 'Based on national estimates, not locally verified' },
        caveat:
          'This estimate uses national FHFA/NAHB-style benchmarks rather than county-specific ' +
          'data, so actual local values may differ.',
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
 * Placeholder national economic benchmarks standing in for a live FHFA
 * (House Price Index) / NAHB (Cost of Constructing a Home) data feed. These
 * are illustrative placeholders, not sourced figures — Research Agent must
 * wire up a real data feed before this reaches production users.
 */
export const NATIONAL_ECONOMIC_BENCHMARKS = {
  medianPricePerSqFt: 220,
  reworkCostPerSqFt: 180,
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
}

/** Which source supplied the per-sq-ft figure, in precedence order. */
type PriceSource = 'caller-override' | 'market-indexed' | 'assessor-roll' | 'national-benchmark';

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
function resolvePricePerSqFt(inputs: EconomicImpactInputs): ResolvedPrice {
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

  return { price: NATIONAL_ECONOMIC_BENCHMARKS.medianPricePerSqFt, source: 'national-benchmark' };
}

export interface DollarRange {
  low: number;
  high: number;
  currency: 'USD';
}

export interface EconomicImpactEstimate {
  lostBuildableAreaSqFt: number;
  valueAtRiskRange: DollarRange;
  reworkCostRange: DollarRange;
  methodology: string;
  dataCoverage: TieredResult<DataCoverageLabel>;
  /** Present when the assessed value was indexed forward to current market. */
  marketAdjustment?: MarketAdjustedParcel;
}

function dollarRange(center: number, variance: number): DollarRange {
  return {
    low: Math.round(center * (1 - variance)),
    high: Math.round(center * (1 + variance)),
    currency: 'USD',
  };
}

export function buildEconomicImpactEstimate(inputs: EconomicImpactInputs): EconomicImpactEstimate {
  const { price: pricePerSqFt, source: priceSource, adjustment } = resolvePricePerSqFt(inputs);
  const lostBuildableAreaSqFt = inputs.easementAreaSqFt;
  const valueAtRiskCenter = lostBuildableAreaSqFt * pricePerSqFt;
  const reworkCostCenter = lostBuildableAreaSqFt * NATIONAL_ECONOMIC_BENCHMARKS.reworkCostPerSqFt;
  const dataCoverage = classifyDataCoverage({
    isLaCounty: inputs.isLaCounty,
    assessorValuation: inputs.assessorValuation,
    marketIndexed: priceSource === 'market-indexed',
  });

  // Show cents when the source value has them, so the stated price matches the
  // one actually multiplied rather than a rounded approximation of it.
  const displayPrice = Number.isInteger(pricePerSqFt)
    ? pricePerSqFt.toLocaleString()
    : pricePerSqFt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const priceSourceNote = {
    'caller-override': `a supplied local price of $${displayPrice}/sq ft`,
    'market-indexed': `a market-indexed land value of $${displayPrice}/sq ft for this parcel`,
    'assessor-roll': inputs.assessorValuation
      ? `the LA County ${inputs.assessorValuation.rollYear} assessed land value of ` +
        `$${displayPrice}/sq ft for this parcel`
      : `an assessed land value of $${displayPrice}/sq ft`,
    'national-benchmark': `the national median estimate of $${displayPrice}/sq ft`,
  }[priceSource];
  const variancePercent = Math.round(NATIONAL_ECONOMIC_BENCHMARKS.varianceBand * 100);

  const methodology =
    `Lost buildable area is the easement's footprint: ${Math.round(lostBuildableAreaSqFt).toLocaleString()} sq ft ` +
    `out of a ${Math.round(inputs.lotAreaSqFt).toLocaleString()} sq ft lot. Value at risk multiplies that area by ` +
    `${priceSourceNote}, shown as a range of ±${variancePercent}% to reflect estimate uncertainty. ` +
    `Rework cost applies the national average cost to rebuild or relocate a structure, ` +
    `$${NATIONAL_ECONOMIC_BENCHMARKS.reworkCostPerSqFt}/sq ft, to the same area, with the same ` +
    `variance band. ${dataCoverageLabelText(dataCoverage)}.` +
    (adjustment ? ` ${adjustment.note}` : '');

  return {
    lostBuildableAreaSqFt,
    valueAtRiskRange: dollarRange(valueAtRiskCenter, NATIONAL_ECONOMIC_BENCHMARKS.varianceBand),
    reworkCostRange: dollarRange(reworkCostCenter, NATIONAL_ECONOMIC_BENCHMARKS.varianceBand),
    methodology,
    dataCoverage,
    ...(adjustment ? { marketAdjustment: adjustment } : {}),
  };
}
