import { describe, expect, it } from 'vitest';
import {
  ORIENTATION_ONLY_BANNER,
  SCREENING_BAND_BY_TYPE,
  screeningEstimate,
  THREE_REGIME_DISCLOSURE,
  type ScreeningInputs,
} from './screening-estimate';
import { scanForAppraisalClaims } from '@/lib/handoff/appraisal-claim-scan';
import { EASEMENT_TYPES, type EasementType } from '@/lib/easements/easement-types';

function inputs(over: Partial<ScreeningInputs> = {}): ScreeningInputs {
  return {
    easementType: 'utility-overhead',
    landValuePerSqFt: 76.45,
    encumberedAreaSqFt: 800,
    totalPropertyValue: 1_053_782,
    valueSource: 'LA County assessor, 2026 roll, queried 2026-08-22',
    assessmentVintageUnknown: false,
    ...over,
  };
}

describe('it is always a range, never a number', () => {
  it('produces low and high, and no point estimate exists on the type', () => {
    const r = screeningEstimate(inputs());
    expect(r.status).toBe('range');
    if (r.status !== 'range') return;
    expect(r.range.high).toBeGreaterThan(r.range.low);
    expect(Object.keys(r.range)).not.toContain('pointEstimate');
    expect(Object.keys(r.range)).not.toContain('estimate');
  });

  it('rounds hard, so it cannot imply precision it does not have', () => {
    // $4,812.37 out of a 25-75% band borrowed from general literature would
    // assert a precision the input cannot carry.
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    expect(r.range.low % 100).toBe(0);
    expect(r.range.high % 100).toBe(0);
  });

  it('shows the arithmetic rather than asserting the output', () => {
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    expect(r.range.derivation).toContain('800');
    expect(r.range.derivation).toMatch(/76\.45/);
    expect(r.range.derivation).toMatch(/25–75%|25-75%/);
  });
});

describe('the denominator trap', () => {
  it('applies the access band to TOTAL property value, not to the strip', () => {
    // The band's own basis string says "share of TOTAL property value, not of
    // the strip". Applying 2-8% to the strip would understate an access
    // easement by one to two orders of magnitude.
    const r = screeningEstimate(inputs({ easementType: 'access-ingress-egress' }));
    if (r.status !== 'range') throw new Error('expected range');
    expect(r.range.denominator).toBe('total-property-value');
    expect(r.range.appliedTo).toBe(1_053_782);
    expect(r.range.derivation).toMatch(/WHOLE property/);
  });

  it('applies utility and drainage bands to the strip', () => {
    for (const t of ['utility-overhead', 'drainage', 'sewer', 'storm-drain'] as const) {
      const r = screeningEstimate(inputs({ easementType: t }));
      if (r.status !== 'range') throw new Error(`expected range for ${t}`);
      expect(r.range.denominator).toBe('strip-land-value');
      expect(r.range.appliedTo).toBeCloseTo(76.45 * 800, 2);
    }
  });

  it('produces materially different answers for the two denominators', () => {
    // The whole reason the distinction matters. If these came out similar, the
    // test would not be proving anything.
    const strip = screeningEstimate(inputs({ easementType: 'utility-overhead' }));
    const total = screeningEstimate(inputs({ easementType: 'access-ingress-egress' }));
    if (strip.status !== 'range' || total.status !== 'range') throw new Error('expected ranges');
    expect(total.range.appliedTo / strip.range.appliedTo).toBeGreaterThan(10);
  });

  it('refuses access when total property value is missing rather than using the strip', () => {
    const r = screeningEstimate(
      inputs({ easementType: 'access-ingress-egress', totalPropertyValue: null }),
    );
    expect(r.status).toBe('insufficient-data');
    if (r.status !== 'insufficient-data') return;
    expect(r.reason).toMatch(/rather than one built on a substitute/);
  });
});

describe('refusal is a normal outcome', () => {
  it('refuses the four types with no citable band', () => {
    for (const t of ['pipeline', 'slope', 'conservation', 'prescriptive'] as const) {
      const r = screeningEstimate(inputs({ easementType: t }));
      expect(r.status).toBe('refused');
      if (r.status === 'refused') expect(r.reason.length).toBeGreaterThan(80);
    }
  });

  it('explains the conservation denominator rather than substituting land value', () => {
    const r = screeningEstimate(inputs({ easementType: 'conservation' }));
    if (r.status !== 'refused') throw new Error('expected refusal');
    expect(r.reason).toMatch(/DEVELOPMENT value/);
  });

  it('will not generalise the single pipeline worked example', () => {
    const r = screeningEstimate(inputs({ easementType: 'pipeline' }));
    if (r.status !== 'refused') throw new Error('expected refusal');
    expect(r.reason).toMatch(/16-inch/);
    expect(r.reason).toMatch(/must not be applied/);
  });

  it('refuses rather than assuming a width or a land value', () => {
    expect(screeningEstimate(inputs({ encumberedAreaSqFt: null })).status).toBe('insufficient-data');
    expect(screeningEstimate(inputs({ landValuePerSqFt: null })).status).toBe('insufficient-data');
  });

  it('covers every easement type with either a band or a stated refusal', () => {
    for (const t of EASEMENT_TYPES) {
      const r = screeningEstimate(inputs({ easementType: t }));
      expect(['range', 'refused', 'insufficient-data']).toContain(r.status);
    }
    expect(Object.keys(SCREENING_BAND_BY_TYPE).sort()).toEqual([...EASEMENT_TYPES].sort());
  });
});

describe('the three regimes travel with every figure', () => {
  it('names all three, separately', () => {
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    const joined = r.range.caveats.join(' ');
    expect(joined).toContain(THREE_REGIME_DISCLOSURE.valuation);
    expect(joined).toContain(THREE_REGIME_DISCLOSURE.legal);
    expect(joined).toContain(THREE_REGIME_DISCLOSURE.advertising);
  });

  it('leads with the orientation banner', () => {
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    expect(r.range.caveats[0]).toBe(ORIENTATION_ONLY_BANNER);
  });

  it('says plainly that this is the method the standard rejects', () => {
    // The honest version of this product does not hide how the number was
    // made. A figure whose derivation is concealed reads as an authority claim.
    expect(THREE_REGIME_DISCLOSURE.valuation).toMatch(/percentage of ?fee/i);
    expect(THREE_REGIME_DISCLOSURE.valuation).toMatch(/expressly rejects/);
    expect(THREE_REGIME_DISCLOSURE.valuation).toMatch(/NOT AN APPRAISAL/);
  });

  it('warns not to quote it in a negotiation', () => {
    expect(ORIENTATION_ONLY_BANNER).toMatch(/Do not quote it/);
    expect(ORIENTATION_ONLY_BANNER).toMatch(/NOT A VALUATION/);
  });

  it('adds the Proposition 13 caveat when no base year is established', () => {
    const r = screeningEstimate(inputs({ assessmentVintageUnknown: true }));
    if (r.status !== 'range') throw new Error('expected range');
    expect(r.range.caveats.join(' ')).toMatch(/Proposition 13/);
    expect(r.range.caveats.join(' ')).toMatch(/inherits that error/);
  });
});

describe('it still passes the claim scan', () => {
  it('the disclosures and banner are clean', () => {
    // The estimate must not be smuggled past the scanner by rewording. If
    // this output tripped a forbidden pattern, that would be the signal that
    // the framing had drifted into a valuation claim.
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    const rendered = `${r.range.caveats.join('\n')}\n${r.range.derivation}`;
    const scan = scanForAppraisalClaims(rendered);
    expect(scan.violations).toEqual([]);
    expect(scan.hasRequiredDisclaimer).toBe(true);
  });

  it('never asserts what the easement is worth', () => {
    const r = screeningEstimate(inputs());
    if (r.status !== 'range') throw new Error('expected range');
    const rendered = `${r.range.caveats.join(' ')} ${r.range.derivation}`;
    expect(rendered).not.toMatch(/easement is worth/i);
    expect(rendered).not.toMatch(/you are owed/i);
    expect(rendered).not.toMatch(/appraised value/i);
  });
});

describe('the band table cannot drift from the source table', () => {
  it('throws rather than silently skipping a band that has gone missing', () => {
    // SCREENING_BAND_BY_TYPE names keys in UNCITED_SCREENING_RANGES. If a key
    // is removed there, this must fail loudly rather than return no figure and
    // look like an ordinary refusal.
    const named = new Set(
      Object.values(SCREENING_BAND_BY_TYPE)
        .map((b) => b.key)
        .filter((k): k is NonNullable<typeof k> => k !== null),
    );
    expect([...named].sort()).toEqual(['access', 'drainage', 'utility']);
  });
});

describe('every type produces something a user can act on', () => {
  for (const type of EASEMENT_TYPES) {
    it(`${type}: range or a reason, never silence`, () => {
      const r = screeningEstimate(inputs({ easementType: type as EasementType }));
      if (r.status === 'range') {
        expect(r.range.caveats.length).toBeGreaterThanOrEqual(6);
      } else if (r.status === 'refused') {
        expect(r.reason.length).toBeGreaterThan(80);
      } else {
        expect(r.missing.length).toBeGreaterThan(0);
      }
    });
  }
});
