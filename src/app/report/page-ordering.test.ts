import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The page must obey the same ordering rule as the referral package: nothing
 * that looks like an ESTIMATE appears before the limits.
 *
 * This is asserted because it already broke once. The Track 3 economic-impact
 * block rendered "Value at risk: $78,934 – $118,400" above every caveat on the
 * page, carrying none of the three-regime disclosure — an older and less
 * qualified range sitting above the carefully qualified one, which is worse
 * than either alone. The referral package has enforced this since it was
 * written, by index comparison; the page had no equivalent guard.
 *
 * Source-text rather than render-based, because these are async server
 * components that reach live county services. It is the weaker technique and
 * it is the one that runs in CI. Stated plainly rather than dressed up.
 */
const PAGE = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

/** Heading text in the order a reader meets it. */
function headingIndex(text: string): number {
  const i = PAGE.indexOf(`<h2>${text}`);
  return i;
}

describe('no estimate renders above the limits', () => {
  const LIMITS = 'What this report does not tell you';

  it('the limits section exists and is found', () => {
    expect(headingIndex(LIMITS)).toBeGreaterThan(-1);
  });

  for (const section of [
    'Roughly what scale of question is this?',
    'What the easement costs you in use',
    'What to do about it, in order',
    'Taking this to a professional',
  ]) {
    it(`"${section}" comes after the limits`, () => {
      const at = headingIndex(section);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeGreaterThan(headingIndex(LIMITS));
    });
  }

  it('the county parcel panel may stay above, being a published fact', () => {
    // The assessed value is a recorded figure from the county, not an estimate
    // this product produced. The rule is about estimates.
    expect(headingIndex('Your parcel, according to the county')).toBeLessThan(
      headingIndex(LIMITS),
    );
  });
});

describe('the screening figure never renders without its disclosures', () => {
  it('references the orientation banner and all three regimes', () => {
    expect(PAGE).toContain('ORIENTATION_ONLY_BANNER');
    expect(PAGE).toContain('THREE_REGIME_DISCLOSURE.valuation');
    expect(PAGE).toContain('THREE_REGIME_DISCLOSURE.legal');
    expect(PAGE).toContain('THREE_REGIME_DISCLOSURE.advertising');
  });

  it('renders the derivation, so the arithmetic is never hidden', () => {
    // A figure whose derivation is concealed reads as an authority claim.
    expect(PAGE).toContain('screening.range.derivation');
  });

  it('handles refusal and insufficient-data as ordinary outcomes', () => {
    expect(PAGE).toContain("screening.status === 'refused'");
    expect(PAGE).toContain("screening.status === 'insufficient-data'");
  });
});
