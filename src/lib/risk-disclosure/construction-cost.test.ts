import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_COST_BY_DIVISION,
  divisionForState,
  NATIONAL_CONSTRUCTION_COST_PER_SQ_FT,
  resolveConstructionCost,
} from './construction-cost';

describe('divisionForState', () => {
  it('maps California to the Pacific division', () => {
    expect(divisionForState('CA')).toBe('pacific');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(divisionForState(' ca ')).toBe('pacific');
  });

  it('maps a state from each division', () => {
    expect(divisionForState('MA')).toBe('new-england');
    expect(divisionForState('NY')).toBe('middle-atlantic');
    expect(divisionForState('OH')).toBe('east-north-central');
    expect(divisionForState('MN')).toBe('west-north-central');
    expect(divisionForState('FL')).toBe('south-atlantic');
    expect(divisionForState('TN')).toBe('east-south-central');
    expect(divisionForState('TX')).toBe('west-south-central');
    expect(divisionForState('CO')).toBe('mountain');
  });

  it('returns null for an unrecognized code', () => {
    expect(divisionForState('XX')).toBeNull();
  });

  it('covers all 50 states plus DC', () => {
    const states = (
      'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO ' +
      'MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'
    ).split(' ');
    expect(states).toHaveLength(51);
    for (const s of states) {
      expect(divisionForState(s), `${s} should map to a division`).not.toBeNull();
    }
  });
});

describe('resolveConstructionCost', () => {
  it('uses the Pacific figure for California', () => {
    const result = resolveConstructionCost('CA');
    expect(result.division).toBe('pacific');
    expect(result.costPerSqFt).toBe(167);
    expect(result.isDivisionReported).toBe(true);
  });

  it('varies by region rather than applying one national number', () => {
    // A single national figure would be wrong by ~1.5x across the country.
    expect(resolveConstructionCost('MA').costPerSqFt).toBe(190);
    expect(resolveConstructionCost('TN').costPerSqFt).toBe(129);
    expect(resolveConstructionCost('MA').costPerSqFt / resolveConstructionCost('TN').costPerSqFt)
      .toBeGreaterThan(1.4);
  });

  it('falls back to the national median when no state is supplied', () => {
    const result = resolveConstructionCost();
    expect(result.division).toBeNull();
    expect(result.costPerSqFt).toBe(NATIONAL_CONSTRUCTION_COST_PER_SQ_FT);
    expect(result.isDivisionReported).toBe(false);
  });

  it('falls back for an unrecognized state code', () => {
    expect(resolveConstructionCost('XX').costPerSqFt).toBe(NATIONAL_CONSTRUCTION_COST_PER_SQ_FT);
  });

  it('flags west-north-central as not separately reported', () => {
    // The source omits this division; it is defaulted rather than invented.
    const result = resolveConstructionCost('MN');
    expect(result.division).toBe('west-north-central');
    expect(result.isDivisionReported).toBe(false);
    expect(result.costPerSqFt).toBe(NATIONAL_CONSTRUCTION_COST_PER_SQ_FT);
    expect(result.note).toContain('national median');
  });

  it('states the source and that the figure excludes lot value', () => {
    const note = resolveConstructionCost('CA').note;
    expect(note).toContain('Census Survey of Construction');
    expect(note).toContain('excluding lot value');
  });

  it('discloses that rework exceeds new-construction cost', () => {
    // The figure is new-build on an open site; rework adds demolition and
    // site constraints, so it must not read as a quote.
    const note = resolveConstructionCost('CA').note;
    expect(note).toContain('demolition');
    expect(note).toContain('lower bound');
  });

  it('keeps every division figure positive and plausible', () => {
    for (const [division, cost] of Object.entries(CONSTRUCTION_COST_BY_DIVISION)) {
      expect(cost, division).toBeGreaterThan(100);
      expect(cost, division).toBeLessThan(400);
    }
  });
});
