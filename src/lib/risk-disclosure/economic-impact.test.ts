import { describe, expect, it } from 'vitest';
import { buildEconomicImpactEstimate, classifyDataCoverage, NATIONAL_ECONOMIC_BENCHMARKS } from './economic-impact';
import type { AssessorParcelValuation } from './la-county-assessor-provider';

/** Mirrors a real record: AIN 2004001003, verified live 2026-07-25. */
const ASSESSOR_RECORD: AssessorParcelValuation = {
  ain: '2004001003',
  apn: '2004-001-003',
  situsFullAddress: '8321 FAUST AVE LOS ANGELES CA 91304',
  lotAreaSqFt: 9685.58,
  landValue: 740440,
  improvementValue: 313342,
  rollYear: '2026',
  landBaseYear: '2006',
  landValuePerSqFt: 740440 / 9685.58,
};

describe('classifyDataCoverage', () => {
  it('labels an estimate backed by assessor data as clear/verified', () => {
    const result = classifyDataCoverage({ isLaCounty: true, assessorValuation: ASSESSOR_RECORD });
    expect(result.tier).toBe('clear');
    if (result.tier === 'clear') {
      expect(result.value.label).toContain('2026 assessment roll');
      expect(result.value.label).toContain('2004001003');
    }
  });

  it('does not claim verification for an LA County address with no assessor record', () => {
    // Regression: this previously returned tier 'clear' labelled "Verified
    // against LA County reference data" while every figure came from the
    // national placeholder — asserting verification that never happened.
    const result = classifyDataCoverage({ isLaCounty: true });
    expect(result.tier).toBe('likely-with-caveat');
    if (result.tier === 'likely-with-caveat') {
      expect(result.value.label).not.toContain('Verified');
      expect(result.caveat).toContain('not verified against county data');
    }
  });

  it('labels non-LA-County addresses as likely-with-caveat/national estimate', () => {
    const result = classifyDataCoverage({ isLaCounty: false });
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

  it('indexes the assessed value forward to market by default', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
    });
    // 2006 base year, so the raw figure reflects a 20-year-old market.
    expect(result.marketAdjustment).toBeDefined();
    expect(result.marketAdjustment!.indexed.baseYear).toBe(2006);
    expect(result.marketAdjustment!.indexed.indexRatio).toBeGreaterThan(1);
    expect(result.valueAtRiskRange.low).toBeGreaterThan(
      Math.round(500 * ASSESSOR_RECORD.landValuePerSqFt * 0.8),
    );
    expect(result.methodology).toContain('market-indexed');
  });

  it('grades a modelled price as likely-with-caveat, never clear', () => {
    // 'clear' gates direct assertion in a paid letter; an indexed figure is a
    // model output and must not be asserted that way.
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
    });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    if (result.dataCoverage.tier === 'likely-with-caveat') {
      expect(result.dataCoverage.caveat).toContain('Proposition 13');
    }
  });

  it('prices from the raw assessor roll when indexing is disabled', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
      applyMarketIndex: false,
    });
    // ~$76.45/sq ft from the roll, not the $220 national placeholder.
    const expectedCenter = 500 * ASSESSOR_RECORD.landValuePerSqFt;
    expect(result.valueAtRiskRange.low).toBe(Math.round(expectedCenter * 0.8));
    expect(result.dataCoverage.tier).toBe('clear');
    expect(result.methodology).toContain('assessed land value');
  });

  it('falls back to the raw assessed value when no base year is recorded', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: { ...ASSESSOR_RECORD, landBaseYear: null },
    });
    expect(result.marketAdjustment).toBeUndefined();
    expect(result.valueAtRiskRange.low).toBe(
      Math.round(500 * ASSESSOR_RECORD.landValuePerSqFt * 0.8),
    );
  });

  it('lets an explicit override win over assessor data', () => {
    const result = buildEconomicImpactEstimate({
      lotAreaSqFt: ASSESSOR_RECORD.lotAreaSqFt,
      easementAreaSqFt: 500,
      isLaCounty: true,
      assessorValuation: ASSESSOR_RECORD,
      pricePerSqFtOverride: 900,
    });
    expect(result.valueAtRiskRange.low).toBe(Math.round(500 * 900 * 0.8));
    expect(result.methodology).toContain('supplied local price');
  });

  it('falls back to national benchmarks for an LA County lot with no assessor record', () => {
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: true });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    expect(result.methodology).toContain('national median estimate');
    expect(result.methodology).not.toContain('Verified');
  });

  it('carries the national-estimate coverage label through to the estimate', () => {
    const result = buildEconomicImpactEstimate({ lotAreaSqFt: 5000, easementAreaSqFt: 500, isLaCounty: false });
    expect(result.dataCoverage.tier).toBe('likely-with-caveat');
    expect(result.methodology).toContain('Based on national estimates');
  });
});
