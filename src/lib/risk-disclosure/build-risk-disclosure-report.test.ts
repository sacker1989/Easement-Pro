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
