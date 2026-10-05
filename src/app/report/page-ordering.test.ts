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

/**
 * The duration analysis is a FINDING about the document, so it must sit with
 * the other findings and above the limits, like everything else here.
 *
 * It also must not drift below "What should be on record" — that section is
 * about documents the homeowner does NOT have, and reading it before the
 * analysis of the document they DO have inverts the narrative: it opens on
 * what is missing before saying anything about what exists.
 */
describe('the duration analysis sits in the right place', () => {
  it('renders above the limits section, like every other finding', () => {
    const duration = headingIndex('How long does it last?');
    const limits = headingIndex('What this report does not tell you');
    expect(duration).toBeGreaterThan(-1);
    expect(limits).toBeGreaterThan(-1);
    expect(duration).toBeLessThan(limits);
  });

  it('renders before the what-should-exist section', () => {
    const duration = headingIndex('How long does it last?');
    const shouldExist = PAGE.indexOf('What should be on record');
    expect(shouldExist).toBeGreaterThan(-1);
    expect(duration).toBeLessThan(shouldExist);
  });

  it('is gated on the homeowner having told us something', () => {
    // An untouched form means legalCharacter 'unknown' and no language flags,
    // which produces a flag about a document nobody described. Rendering that
    // reads as a finding about THEIR easement rather than an absence of
    // input — alarming and uninformative at once.
    expect(PAGE).toMatch(
      /hasPerpetualLanguage \|\| hasTermOrConditionSubsequent \|\| legalCharacter !== 'unknown'/,
    );
  });

  it('asks whether the document is ILLEGIBLE, not whether it is legible', () => {
    // An unchecked box is the default and the default has to be the common
    // case. Asking "is it legible?" and defaulting to unchecked would make
    // every untouched form claim an unreadable document.
    expect(PAGE).toContain('name="documentIllegible"');
    expect(PAGE).not.toContain('name="documentLegible"');
  });

  it('keeps the legal character on its own query parameter', () => {
    // `easementType` is the PHYSICAL taxonomy on this page — sewer, overhead
    // line, driveway. The legal character is orthogonal and was once called
    // the same thing, which is documented at length in duration-facts.ts.
    // Sharing a parameter would silently merge the two axes.
    expect(PAGE).toContain('searchParams.legalCharacter');
    expect(PAGE).toContain('name="legalCharacter"');
  });
});
