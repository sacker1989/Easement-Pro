import { describe, expect, it } from 'vitest';
import { buildRiskDisclosureReport, InvalidRiskDisclosureInputError } from './build-risk-disclosure-report';
import type { AssessorParcelValuation } from './la-county-assessor-provider';

const baseInput = {
  easementPurpose: 'utility' as const,
  lotAreaSqFt: 8000,
  easementAreaSqFt: 800,
  isLaCounty: true,
};

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

describe('buildRiskDisclosureReport', () => {
  it('combines a restriction checklist and an economic impact estimate', () => {
    const report = buildRiskDisclosureReport(baseInput);
    expect(report.restrictionChecklist).toHaveLength(4);
    expect(report.economicImpact.lostBuildableAreaSqFt).toBe(800);
  });

  it('reaches clear coverage only when an assessor record is threaded through', () => {
    const withoutRecord = buildRiskDisclosureReport(baseInput);
    expect(withoutRecord.economicImpact.dataCoverage.tier).toBe('likely-with-caveat');

    const withRecord = buildRiskDisclosureReport({
      ...baseInput,
      assessorValuation: ASSESSOR_RECORD,
      applyMarketIndex: false,
    });
    expect(withRecord.economicImpact.dataCoverage.tier).toBe('clear');
    expect(withRecord.economicImpact.methodology).toContain('2026 assessment roll');
  });

  it('rejects a non-positive lot area', () => {
    expect(() => buildRiskDisclosureReport({ ...baseInput, lotAreaSqFt: 0 })).toThrow(
      InvalidRiskDisclosureInputError,
    );
  });

  it('rejects a non-positive easement area', () => {
    expect(() => buildRiskDisclosureReport({ ...baseInput, easementAreaSqFt: -5 })).toThrow(
      InvalidRiskDisclosureInputError,
    );
  });

  it('rejects an easement area larger than the lot itself', () => {
    expect(() =>
      buildRiskDisclosureReport({ ...baseInput, easementAreaSqFt: 9000, lotAreaSqFt: 8000 }),
    ).toThrow(InvalidRiskDisclosureInputError);
  });
});

describe('why a dollar range is unavailable', () => {
  /*
   * SHIPPED WRONG FOR AN HOUR AND CAUGHT BY READING THE RENDERED PAGE. The
   * condominium refusal reused the only reason the module had: "No land value
   * is published for this address… Your county assessor publishes an assessed
   * land value — that is the number this needs." For a unit in a
   * common-interest development the county publishes one, the report shows it
   * in the parcel panel immediately above, and the reader was being sent to
   * the assessor for a figure they could already see. Being confidently wrong
   * about who to ask is the same defect as calling a city department "the
   * county", which shipped the same evening.
   */
  const base = {
    easementPurpose: 'utility' as const,
    lotAreaSqFt: 135871,
    easementAreaSqFt: 800,
    isLaCounty: false,
    state: 'CA',
  };

  it('tells a condominium owner the figures cannot be divided, not that they are missing', () => {
    const r = buildRiskDisclosureReport({ ...base, noPriceReason: 'undivided-interest' });
    const v = r.economicImpact.valueAtRisk;
    expect(v.status).toBe('unavailable');
    if (v.status !== 'unavailable') return;
    expect(v.reason).toMatch(/not missing data/i);
    expect(v.reason).toMatch(/every unit in the project carries the same lot area/i);
    expect(v.reason).not.toMatch(/No land value is published/);
  });

  it('points them at the declaration rather than the assessor', () => {
    const r = buildRiskDisclosureReport({ ...base, noPriceReason: 'undivided-interest' });
    const v = r.economicImpact.valueAtRisk;
    if (v.status !== 'unavailable') throw new Error('expected unavailable');
    expect(v.reason).toMatch(/CC&Rs/);
    expect(v.reason).toMatch(/association/i);
    // The errand that was being sent before.
    expect(v.reason).not.toMatch(/that is the number this needs/i);
  });

  it('refuses to multiply the fractional share back out', () => {
    const r = buildRiskDisclosureReport({ ...base, noPriceReason: 'undivided-interest' });
    const v = r.economicImpact.valueAtRisk;
    if (v.status !== 'unavailable') throw new Error('expected unavailable');
    expect(v.reason).toMatch(/burdens the development rather than your unit/i);
  });

  it('keeps the original reason where the land value really is absent', () => {
    const r = buildRiskDisclosureReport(base);
    const v = r.economicImpact.valueAtRisk;
    if (v.status !== 'unavailable') throw new Error('expected unavailable');
    expect(v.reason).toMatch(/No land value is published for this address/);
    expect(v.reason).not.toMatch(/CC&Rs/);
  });

  it('still prices a parcel that has a land value', () => {
    const r = buildRiskDisclosureReport({
      ...base,
      lotAreaSqFt: 6756,
      countyLandValue: { county: 'Orange County', perSqFt: 73.02 },
    });
    expect(r.economicImpact.valueAtRisk.status).toBe('range');
  });
});
