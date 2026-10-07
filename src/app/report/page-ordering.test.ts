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
/**
 * Line endings normalised to LF before any assertion runs.
 *
 * Several assertions below match multi-line snippets. Git checks this
 * repository out with CRLF on Windows, so a snippet written with "\n" matches
 * on one developer's machine and fails on another's — which is a property of
 * the checkout, not of the code under test. Normalising makes the assertions
 * mean what they look like they mean.
 */
const PAGE = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

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
 * The flood-vulnerability section is a FINDING about how the easement
 * changes what water does, so it sits with the other findings, above the
 * limits — and it must reuse the single FEMA query rather than adding
 * another upstream call.
 */
describe('the flood-vulnerability section sits in the right place', () => {
  // The heading renders via the FLOOD_VULNERABILITY_HEADING constant, so
  // ordering is asserted on the constant's JSX use site in the page source.
  // (The import line has no braces around the name; only the use site does.)
  const floodUseSite = () => PAGE.indexOf('{FLOOD_VULNERABILITY_HEADING}');

  it('renders above the limits section, like every other finding', () => {
    const flood = floodUseSite();
    const limits = headingIndex('What this report does not tell you');
    expect(flood).toBeGreaterThan(-1);
    expect(limits).toBeGreaterThan(-1);
    expect(flood).toBeLessThan(limits);
  });

  it('renders after the flood-zone panel, not before it', () => {
    const vuln = floodUseSite();
    const panel = headingIndex('Flood risk, and what it costs');
    expect(panel).toBeGreaterThan(-1);
    expect(vuln).toBeGreaterThan(panel);
  });

  it('makes exactly one FEMA query — the section reuses the existing result', () => {
    // A second lookupFloodZone( call would double the FEMA latency on every
    // report. The builder takes the already-fetched result as an argument.
    const calls = PAGE.match(/lookupFloodZone\(/g) ?? [];
    expect(calls).toHaveLength(1);
  });

  it('never leads its headline with the word "easement"', () => {
    expect(PAGE).toContain('FLOOD_VULNERABILITY_HEADING');
    expect(PAGE).not.toContain('<h2>Easement');
  });
});
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

describe('the IRWA section obeys the same ordering rule', () => {
  const IRWA_HEADING = 'The same question, by the IRWA method';

  it('renders below the limits, never above them', () => {
    const at = headingIndex(IRWA_HEADING);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(headingIndex('What this report does not tell you'));
  });

  it('is never called compensation, market value, or an appraisal in the page', () => {
    // The conflict notice forbids presenting matrix output as any of these.
    // A literal claim in the rendered copy would be a defect.
    const idx = PAGE.indexOf(`<h2>${IRWA_HEADING}</h2>`);
    const section = PAGE.slice(idx, idx + 4000);
    expect(section.toLowerCase()).not.toMatch(/this is (your )?compensation/);
    expect(section.toLowerCase()).not.toMatch(/market value of your (property|home)/);
  });
});

describe('the fire section sits with the value-and-protection findings', () => {
  it('is wired between the flood panel and the limits', () => {
    // The heading itself renders from the content builder, so the placement
    // assertion is on source anchors: the fire block must sit after the flood
    // panel and before the limits section.
    const floodAt = PAGE.indexOf('FLOOD_ZONE_DISCLOSURE');
    const fireAt = PAGE.indexOf('buildFireSafetyContent(easementType, fireSeverity)');
    const limitsAt = PAGE.indexOf('<h2>What this report does not tell you</h2>');
    expect(floodAt).toBeGreaterThan(-1);
    expect(fireAt).toBeGreaterThan(-1);
    expect(limitsAt).toBeGreaterThan(-1);
    expect(fireAt).toBeGreaterThan(floodAt);
    expect(fireAt).toBeLessThan(limitsAt);
  });

  it('runs the CAL FIRE lookup in parallel with the FEMA query', () => {
    // One Promise.all for the two lookups: worst case adds max(FEMA, CAL
    // FIRE), not the sum. A future sequential rewrite would slow every
    // report and should break this test first.
    expect(PAGE).toContain("observe(\n            'calfire-fhsz',");
    const allIdx = PAGE.indexOf('await Promise.all([');
    const fireIdx = PAGE.indexOf("'calfire-fhsz'");
    const femaIdx = PAGE.indexOf("'fema-nfhl'");
    expect(allIdx).toBeGreaterThan(-1);
    expect(fireIdx).toBeGreaterThan(allIdx);
    expect(femaIdx).toBeGreaterThan(allIdx);
  });
});
