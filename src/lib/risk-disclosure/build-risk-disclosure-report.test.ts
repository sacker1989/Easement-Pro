import { describe, expect, it } from 'vitest';
import { buildRiskDisclosureReport, InvalidRiskDisclosureInputError } from './build-risk-disclosure-report';

const baseInput = {
  easementPurpose: 'utility' as const,
  lotAreaSqFt: 8000,
  easementAreaSqFt: 800,
  isLaCounty: true,
};

describe('buildRiskDisclosureReport', () => {
  it('combines a restriction checklist and an economic impact estimate', () => {
    const report = buildRiskDisclosureReport(baseInput);
    expect(report.restrictionChecklist).toHaveLength(4);
    expect(report.economicImpact.lostBuildableAreaSqFt).toBe(800);
    expect(report.economicImpact.dataCoverage.tier).toBe('clear');
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
