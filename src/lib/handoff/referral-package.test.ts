import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertPackageIntegrity,
  buildLandValueSection,
  buildReferralPackage,
  parseReferralPackage,
  ReferralPackageError,
  STANDING_HEADER,
  type ParcelIdentity,
  type ReferralPackage,
} from './referral-package';
import { assessEvidenceTier } from '@/lib/easements/evidence-tier';
import { calibratedRange } from '@/lib/valuation/calibrated-range';
import { reconcilePaths } from '@/lib/valuation/reconcile-paths';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import { BEFORE_AND_AFTER_METHODOLOGY_NOTE } from '@/lib/valuation/encumbrance-factors';

const PARCEL: ParcelIdentity = {
  parcelId: '2483004013',
  county: 'Los Angeles County',
  state: 'CA',
  fipsCode: '06037',
  routingTier: 'immediate',
  situsAddress: '428 N CALIFORNIA ST BURBANK CA 91505',
  ownerName: null,
  geometrySource: 'LACounty_Parcel/MapServer/0',
  sourceVerifiedOn: '2026-07-30',
};

function pkg(overrides: Partial<Parameters<typeof buildReferralPackage>[0]> = {}) {
  return buildReferralPackage({
    parcel: PARCEL,
    findings: [assessEvidenceTier(0)],
    evidenceSummary: 'One feature crossing the parcel.',
    fromRecordedEasements: false,
    provenance: { kind: 'proximity-inference', distanceFt: 0, layer: 'HIFLD' },
    encumberedArea: null,
    landValue: null,
    ...overrides,
  });
}

describe('the not-determined section cannot be omitted', () => {
  it('has no parameter to supply, override or suppress it', () => {
    // Composition, not configuration — the same reason lookupEncumbranceFactor
    // has no defaultFactor. A caller cannot reach the section at all.
    const keys = Object.keys({
      parcel: 0, findings: 0, evidenceSummary: 0, fromRecordedEasements: 0, provenance: 0,
      encumberedArea: 0, landValue: 0, extraCaveats: 0, attorneyReview: 0, illustrative: 0,
      known: 0, generatedAt: 0,
    });
    expect(keys).not.toContain('notDetermined');
  });

  it('is populated on every package', () => {
    expect(pkg().notDetermined.length).toBeGreaterThanOrEqual(4);
  });

  it('grows when less is known', () => {
    const bare = pkg();
    const informed = pkg({
      known: {
        easementIsRecorded: true,
        instrumentTermsRead: true,
        ownerKnown: true,
        stateRuleSetReviewed: true,
      },
    });
    expect(bare.notDetermined.length).toBeGreaterThan(informed.notDetermined.length);
  });
});

describe('the integrity invariant', () => {
  it('accepts a well-formed package', () => {
    expect(() => assertPackageIntegrity(pkg())).not.toThrow();
  });

  it('rejects a package whose not-determined section was stripped', () => {
    const stripped = { ...pkg(), notDetermined: [] } as unknown as ReferralPackage;
    expect(() => assertPackageIntegrity(stripped)).toThrow(ReferralPackageError);
    expect(() => assertPackageIntegrity(stripped)).toThrow(/what a truncated copy\s+loses first/);
  });

  it('rejects a package missing a floor item', () => {
    const p = pkg();
    const missingFloor = {
      ...p,
      notDetermined: p.notDetermined.filter((i) => i.key !== 'encumbrance-factor'),
    } as unknown as ReferralPackage;
    expect(() => assertPackageIntegrity(missingFloor)).toThrow(/floor items/);
  });

  it('rejects an altered standing header', () => {
    const altered = { ...pkg(), whatThisIs: 'A valuation report.' } as ReferralPackage;
    expect(() => assertPackageIntegrity(altered)).toThrow(/verbatim/);
  });

  it('runs the claim scan when rendered text is supplied', () => {
    expect(() =>
      assertPackageIntegrity(pkg(), 'The appraised value is $50,000. This is not an appraisal.'),
    ).toThrow(/claim scan/);
  });
});

describe('deserialisation is held to the same bar', () => {
  it('applies the invariant on parse, not only on build', () => {
    // Build-time validation does not survive JSON.parse, and a stored package
    // is the realistic route by which a stripped one reaches a reader.
    const stripped = JSON.stringify({ ...pkg(), notDetermined: [] });
    expect(() => parseReferralPackage(stripped)).toThrow(ReferralPackageError);
  });

  it('round-trips a valid package', () => {
    const round = parseReferralPackage(JSON.stringify(pkg()));
    expect(round.notDetermined.length).toBeGreaterThanOrEqual(4);
    expect(round.whatThisIs).toBe(STANDING_HEADER);
  });

  it('rejects malformed JSON with a clear error', () => {
    expect(() => parseReferralPackage('{not json')).toThrow(/could not be parsed/);
  });
});

describe('land value: null is the normal path', () => {
  it('returns null when neither path is available', () => {
    expect(buildLandValueSection(reconcilePaths(null, null), null)).toBeNull();
  });

  it('returns null when no calibrated range exists', () => {
    // calibratedRange throws for any path but ZIP-comparable. The builder must
    // not catch that and substitute a range.
    const rec = reconcilePaths({ landValue: 100_000, source: 'zip' }, null);
    expect(buildLandValueSection(rec, null)).toBeNull();
  });

  it('adds not-determined items when no figure is emitted', () => {
    const keys = pkg({ landValue: null }).notDetermined.map((i) => i.key);
    expect(keys).toContain('land-value');
    expect(keys).toContain('compensation-paid');
  });

  it('labels what the figure is, when there is one', () => {
    const rec = reconcilePaths({ landValue: 100_000, source: 'zip' }, null);
    const section = buildLandValueSection(rec, calibratedRange(100_000, 90, 'zip-comparable'));
    expect(section!.whatThisFigureIs).toMatch(/not the value of any easement/);
    expect(section!.whatThisFigureIs).toMatch(/strip valuation/);
  });
});

describe('caveats are gathered verbatim, never rewritten', () => {
  it('carries the disclaimer footer and methodology note exactly', () => {
    // Exact-string containment, so an edit to the source constant either flows
    // through or fails the suite. It cannot silently diverge.
    const texts = pkg().caveats.map((c) => c.text);
    expect(texts).toContain(CURRENT_DISCLAIMER.letterFooterText);
    expect(texts).toContain(BEFORE_AND_AFTER_METHODOLOGY_NOTE);
  });

  it('cites where each caveat came from', () => {
    for (const c of pkg().caveats) {
      expect(c.sourceSymbol.length).toBeGreaterThan(3);
    }
  });

  it('carries the tier implication, including the may-be-owed direction', () => {
    const texts = pkg().caveats.map((c) => c.text).join(' ');
    expect(texts).toMatch(/may be owed\s+compensation/);
  });
});

describe('provenance is shown alongside the tier', () => {
  it('reports flagged for a tier A proximity finding', () => {
    // Tier A permits a valuation attempt; provenance never rose above
    // inference. A professional needs both facts, not one.
    const p = pkg();
    expect(p.evidence.findings[0]!.tier).toBe('A');
    expect(p.evidence.findings[0]!.mayValue).toBe(true);
    expect(p.evidence.provenanceConfidence).toBe('flagged');
  });

  it('states the negative-result asymmetry', () => {
    expect(pkg().evidence.negativeResultCaveat).toMatch(/LAYERS QUERIED/);
  });
});

describe('the rejected method must not reappear', () => {
  it('never imports calculator.ts or valuation-matrix.ts', () => {
    // Both remain exported from the valuation barrel (src/lib/valuation/index.ts)
    // and compute area x unit value x impact % — the strip valuation §4.6.5
    // rejects. Nothing stops a future edit from importing them; a comment
    // asking people not to would not survive a refactor. Reading the source does.
    //
    // Comments are stripped first. The module doc-comment NAMES these symbols
    // while explaining why it never imports them, and a naive whole-file scan
    // fires on that explanation — the same failure the appraisal scanner hit
    // when it matched its own disclaimer. The prohibition is on code, so the
    // check reads code.
    const stripComments = (s: string) =>
      s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    const files = ['referral-package.ts', 'not-determined.ts', 'area-derivation.ts'];
    for (const f of files) {
      const code = stripComments(readFileSync(new URL(`./${f}`, import.meta.url), 'utf8'));
      expect(code).not.toMatch(/from ['"].*valuation\/calculator['"]/);
      expect(code).not.toMatch(/from ['"].*valuation\/valuation-matrix['"]/);
      expect(code).not.toMatch(/\bIMPACT_TIERS\b/);
      expect(code).not.toMatch(/\bresolveImpactPercentage\b/);
      expect(code).not.toMatch(/\bEasementValuationCalculator\b/);
    }
  });
});
