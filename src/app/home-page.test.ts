import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from '@/lib/easements/easement-types';

/**
 * The front door is load-bearing now, so it is asserted like everything else.
 *
 * Source-text rather than render-based, for the reason page-ordering.test.ts
 * gives: these are async server components that reach live services. It is the
 * weaker technique and it is the one that runs in CI.
 */
const PAGE = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('the landing page gets a visitor to a report', () => {
  it('posts the form straight to the report, with no intermediate step', () => {
    // A landing page that explains and then asks for a click loses people at
    // the click. If this ever points somewhere else, check it is not a
    // marketing interstitial.
    expect(PAGE).toContain('<form action="/report">');
    expect(PAGE).toContain('name="submitted" value="1"');
  });

  it('asks only for what a homeowner actually knows', () => {
    for (const field of ['street', 'city', 'state', 'zip', 'easementType']) {
      expect(PAGE, `missing field ${field}`).toContain(`name="${field}"`);
    }
    // Lot area and easement area have defaults and nobody knows them. Asking
    // on the front door trades the one thing they definitely know for two they
    // do not. Both stay editable on the report itself.
    expect(PAGE).not.toContain('name="lotAreaSqFt"');
    expect(PAGE).not.toContain('name="easementAreaSqFt"');
  });

  it('offers every easement type, in the homeowner’s words', () => {
    // Driven off EASEMENT_TYPES so a new type cannot be unreachable from the
    // front door — which is how seven of them were once unreachable from the
    // report page.
    expect(PAGE).toContain('EASEMENT_TYPES.map');
    for (const t of EASEMENT_TYPES) {
      expect(PAGE, `no label for ${t}`).toMatch(new RegExp(`['"]?${t}['"]?\\s*:`));
    }
    // Plain language, not the internal identifiers.
    expect(PAGE).toContain('Someone has just always used part of my land');
    expect(PAGE).toContain('A shared driveway or access road');
  });

  it('tells someone who does not know the type to guess', () => {
    // The one piece of real friction. Every downstream section is keyed by
    // type so it cannot be optional, and a wrong first guess that produces a
    // report beats a right answer nobody reaches.
    expect(PAGE).toMatch(/not sure\?/i);
    expect(PAGE).toMatch(/can change it/i);
  });
});

describe('the limits are on the front page, not only the last one', () => {
  it('says it is not legal advice and no attorney reviewed it', () => {
    expect(PAGE).toMatch(/not legal advice and no attorney has reviewed it/i);
  });

  it('says it is not an appraisal', () => {
    expect(PAGE).toMatch(/not an appraisal/i);
  });

  it('says nothing is sent on the user’s behalf', () => {
    // The load-bearing fact under the §6125 posture, stated before a visitor
    // invests five minutes rather than after.
    expect(PAGE).toMatch(/nothing is sent/i);
    expect(PAGE).toMatch(/send yourself/i);
  });

  it('places the limits above the coverage section', () => {
    // A promise followed by its limits, then the small print. If coverage
    // creeps above the limits the page starts selling before it qualifies.
    const limits = PAGE.indexOf('What this can&rsquo;t tell you');
    const coverage = PAGE.indexOf('<h2>Coverage</h2>');
    expect(limits).toBeGreaterThan(-1);
    expect(coverage).toBeGreaterThan(limits);
  });

  it('says free, and says it without a catch', () => {
    expect(PAGE).toMatch(/no account, nothing to buy/i);
  });
});

describe('coverage is read from the registry, not written out', () => {
  it('lists supported counties from SUPPORTED_COUNTIES', () => {
    // Hardcoding three county names here is how a page ends up claiming
    // coverage that was removed, or omitting one that was added.
    expect(PAGE).toContain('SUPPORTED_COUNTIES');
    expect(PAGE).not.toMatch(/Los Angeles County, Orange County, San Diego County/);
  });

  it('says what an uncovered address still gets', () => {
    // Most visitors are outside the three counties. A coverage note that only
    // lists them reads as "not for you".
    expect(PAGE).toMatch(/every other address/i);
    expect(PAGE).toMatch(/work everywhere/i);
  });
});
