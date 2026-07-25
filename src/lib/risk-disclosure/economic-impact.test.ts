import { describe, expect, it } from 'vitest';
import { buildEconomicImpactEstimate, classifyDataCoverage, NATIONAL_ECONOMIC_BENCHMARKS } from './economic-impact';

describe('classifyDataCoverage', () => {
  it('labels LA County addresses as clear/verified', () => {
    const result = classifyDataCoverage(true);
    expect(result.tier).toBe('clear');
    if (result.tier === 'clear') {
      expect(result.value.label).toBe('Verified against LA County reference data');
    }
  });

  it('labels non-LA-County addresses as likely-with-caveat/national estimate', () => {
    const result = classifyDataCoverage(false);
    expect(result.tier).toBe('likely-with-caveat');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.label).toBe('Based on national estimates, not locally verified');
      expect(result.caveat).toBeTruthy();
    }
  });
});

describe('buildEconomicImpactEstimate', () => {
  it('sets lost buildable area equal to the easement footprint', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
    });
    expect(result.lostBuildableAreaSqFt).toBe(1000);
  });

  it('uses the national median price per sq ft by default', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: false,
    });
    const expectedCenter = 1000 * NATIONAL_ECONOMIC_BENCHMARKS.medianPricePerSqFt;
    expect(result.valueAtRiskRange.low).toBe(Math.round(expectedCenter * 0.8));
    expect(result.valueAtRiskRange.high).toBe(Math.round(expectedCenter * 1.2));
  });

  it('uses a supplied local price override instead of the national default', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: 10000,
      easementAreaSqFt: 1000,
      isLaCounty: true,
      pricePerSqFtOverride: 500,
    });
    expect(result.valueAtRiskRange.low).toBe(Math.round(1000 * 500 * 0.8));
    expect(result.methodology).toContain('supplied local price');
  });

  it('carries the LA County coverage label through to the estimate', () => {
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: true });
    expect(result.dataCoverage.tier).toBe('clear');
    expect(result.methodology).toContain('Verified against LA County reference data');
  });

  it('carries the national-estimate coverage label through to the estimate', () => {
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: false });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    expect(result.methodology).toContain('Based on national estimates');
  });
});
