import { describe, expect, it } from 'vitest';

import { EASEMENT_TYPES } from '@/lib/easements/easement-types';
import {
  engineEstimate,
  ENGINE_FEDERAL_NOTE,
  ENGINE_TIER_BY_TYPE,
} from './engine-estimate';
import { ORIENTATION_ONLY_BANNER, THREE_REGIME_DISCLOSURE } from './screening-estimate';

/**
 * The IRWA engine works the same question as the screening range a second
 * way. These tests pin the tier mapping, the range math, the refusals, and
 * the disclosure posture — the four things that would silently change what a
 * homeowner reads.
 */

describe('ENGINE_TIER_BY_TYPE', () => {
  it('covers every easement type (exhaustive by construction)', () => {
    expect(Object.keys(ENGINE_TIER_BY_TYPE).sort()).toEqual([...EASEMENT_TYPES].sort());
  });

  it('maps the tier each example text names', () => {
    expect(ENGINE_TIER_BY_TYPE['utility-overhead']).toMatchObject({ tier: 'severe' });
    expect(ENGINE_TIER_BY_TYPE['pipeline']).toMatchObject({ tier: 'major' });
    expect(ENGINE_TIER_BY_TYPE['storm-drain']).toMatchObject({ tier: 'major' });
    expect(ENGINE_TIER_BY_TYPE['drainage']).toMatchObject({ tier: 'major' });
    expect(ENGINE_TIER_BY_TYPE['sewer']).toMatchObject({ tier: 'moderate_low' });
    expect(ENGINE_TIER_BY_TYPE['water-line']).toMatchObject({ tier: 'moderate_low' });
    expect(ENGINE_TIER_BY_TYPE['utility-underground']).toMatchObject({ tier: 'moderate_low' });
    expect(ENGINE_TIER_BY_TYPE['access-ingress-egress']).toMatchObject({ tier: 'moderate_high' });
    expect(ENGINE_TIER_BY_TYPE['public-right-of-way']).toMatchObject({ tier: 'major' });
  });

  it('every mapping carries its basis in the tier example text', () => {
    for (const [type, mapping] of Object.entries(ENGINE_TIER_BY_TYPE)) {
      if ('refusal' in mapping) continue;
      expect(
        mapping.basis.length,
        `${type} mapping must cite its basis`,
      ).toBeGreaterThan(20);
    }
  });
});

describe('engineEstimate', () => {
  const base = {
    easementType: 'utility-overhead' as const,
    landValuePerSqFt: 10,
    easementAreaSqFt: 800,
    totalPropertyAreaSqFt: 8000,
  };

  it('returns a range across the tier bounds, never a point estimate', () => {
    const r = engineEstimate(base);
    expect(r.status).toBe('range');
    if (r.status !== 'range') return;
    // severe tier: 90–100% of 800 sq ft at $10/sq ft
    expect(r.low).toBe(7200);
    expect(r.high).toBe(8000);
    expect(r.lowPercent).toBe(90);
    expect(r.highPercent).toBe(100);
    expect(r.tierName).toBe('Severe');
    expect('pointEstimate' in r).toBe(false);
  });

  it('states remainder damages as zero rather than assuming them', () => {
    const r = engineEstimate(base);
    expect(r.status).toBe('range');
    if (r.status !== 'range') return;
    expect(r.derivation).toContain('zero');
    expect(r.derivation).toContain('Before-and-After');
    expect(r.derivation).toContain('deliberately not computed');
  });

  it('refuses the three types the area-based matrix does not fit', () => {
    for (const t of ['slope', 'conservation', 'prescriptive'] as const) {
      const r = engineEstimate({ ...base, easementType: t });
      expect(r.status).toBe('refused');
      if (r.status === 'refused') {
        expect(r.reason.length).toBeGreaterThan(20);
      }
    }
  });

  it('returns insufficient-data with homeowner-readable messaging, no defaults', () => {
    const r = engineEstimate({ ...base, landValuePerSqFt: null });
    expect(r.status).toBe('insufficient-data');
    if (r.status === 'insufficient-data') {
      expect(r.missing.length).toBeGreaterThan(0);
      expect(r.reason).toMatch(/nothing is substituted/i);
    }
  });

  it('returns insufficient-data when the easement area exceeds the lot', () => {
    const r = engineEstimate({ ...base, easementAreaSqFt: 9000 });
    expect(r.status).toBe('insufficient-data');
  });

  it('carries the orientation banner, all three regimes, and the federal note', () => {
    const r = engineEstimate(base);
    expect(r.status).toBe('range');
    if (r.status !== 'range') return;
    expect(r.caveats).toContain(ORIENTATION_ONLY_BANNER);
    expect(r.caveats).toContain(THREE_REGIME_DISCLOSURE.valuation);
    expect(r.caveats).toContain(THREE_REGIME_DISCLOSURE.legal);
    expect(r.caveats).toContain(THREE_REGIME_DISCLOSURE.advertising);
    expect(r.caveats).toContain(ENGINE_FEDERAL_NOTE);
  });

  it('states what the figure is not: market value, compensation, appraisal', () => {
    expect(ENGINE_FEDERAL_NOTE).toContain('not market value');
    expect(ENGINE_FEDERAL_NOTE).toContain('not compensation');
    expect(ENGINE_FEDERAL_NOTE).toContain('not an appraisal');
  });
});
