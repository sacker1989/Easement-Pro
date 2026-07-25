import { classifyByRules, type ConfidenceRule, type TieredResult } from '@/lib/analysis-layer/confidence-tiering';

/**
 * Track 3 economic-impact panel: lost buildable area, value range at risk,
 * and rework cost, plus a data-coverage confidence label. Per
 * docs/development-strategy-v2.md: "reuse the existing Clear / Likely /
 * Flagged confidence pattern rather than building separate geographic
 * gating logic" — the label is the only thing that changes by location,
 * never feature availability, so this module never blocks on state/county.
 */

export interface DataCoverageLabel {
  label: string;
}

const DATA_COVERAGE_RULES: ReadonlyArray<ConfidenceRule<{ isLaCounty: boolean }, DataCoverageLabel>> = [
  {
    id: 'la-county-verified',
    evaluate(facts) {
      if (facts.isLaCounty) {
        return { tier: 'clear', value: { label: 'Verified against LA County reference data' } };
      }
      return null;
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

// The national-estimate-default rule above always matches when LA County verification
// doesn't apply, so classifyByRules should never actually reach this fallback.
const UNREACHABLE_FALLBACK = {
  tier: 'flagged-ambiguous',
  flagReason: 'No data-coverage rule matched — this should be unreachable.',
} as const;

export function classifyDataCoverage(isLaCounty: boolean): TieredResult<DataCoverageLabel> {
  return classifyByRules({ isLaCounty }, DATA_COVERAGE_RULES, UNREACHABLE_FALLBACK);
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
}

function dollarRange(center: number, variance: number): DollarRange {
  return {
    low: Math.round(center * (1 - variance)),
    high: Math.round(center * (1 + variance)),
    currency: 'USD',
  };
}

export function buildEconomicImpactEstimate(inputs: EconomicImpactInputs): EconomicImpactEstimate {
  const pricePerSqFt = inputs.pricePerSqFtOverride ?? NATIONAL_ECONOMIC_BENCHMARKS.medianPricePerSqFt;
  const lostBuildableAreaSqFt = inputs.easementAreaSqFt;
  const valueAtRiskCenter = lostBuildableAreaSqFt * pricePerSqFt;
  const reworkCostCenter = lostBuildableAreaSqFt * NATIONAL_ECONOMIC_BENCHMARKS.reworkCostPerSqFt;
  const dataCoverage = classifyDataCoverage(inputs.isLaCounty);

  const priceSourceNote = inputs.pricePerSqFtOverride
    ? `a supplied local price of $${pricePerSqFt}/sq ft`
    : `the national median estimate of $${pricePerSqFt}/sq ft`;
  const variancePercent = Math.round(NATIONAL_ECONOMIC_BENCHMARKS.varianceBand * 100);

  const methodology =
    `Lost buildable area is the easement's footprint: ${lostBuildableAreaSqFt.toLocaleString()} sq ft ` +
    `out of a ${inputs.lotAreaSqFt.toLocaleString()} sq ft lot. Value at risk multiplies that area by ` +
    `${priceSourceNote}, shown as a range of ±${variancePercent}% to reflect estimate uncertainty. ` +
    `Rework cost applies the national average cost to rebuild or relocate a structure, ` +
    `$${NATIONAL_ECONOMIC_BENCHMARKS.reworkCostPerSqFt}/sq ft, to the same area, with the same ` +
    `variance band. ${dataCoverageLabelText(dataCoverage)}.`;

  return {
    lostBuildableAreaSqFt,
    valueAtRiskRange: dollarRange(valueAtRiskCenter, NATIONAL_ECONOMIC_BENCHMARKS.varianceBand),
    reworkCostRange: dollarRange(reworkCostCenter, NATIONAL_ECONOMIC_BENCHMARKS.varianceBand),
    methodology,
    dataCoverage,
  };
}
