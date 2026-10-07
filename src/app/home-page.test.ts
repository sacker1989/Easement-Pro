import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, PRODUCT_NAME } from '@/components/site-footer';

/**
 * The marketing homepage is load-bearing, so it is asserted like everything
 * else.
 *
 * Source-text rather than render-based, for the reason page-ordering.test.ts
 * gives: these are server components that reach live services. It is the
 * weaker technique and it is the one that runs in CI.
 */
const PAGE = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('./globals.css', import.meta.url), 'utf8');

describe('all seven sections are present', () => {
  it('1 — a sticky nav with the wordmark, two links and the CTA', () => {
    expect(PAGE).toContain('className="site-nav"');
    expect(PAGE).toContain('href="#how-it-works"');
    expect(PAGE).toContain('href="#why-it-matters"');
    expect(PAGE).toContain('className="nav-cta"');
    // Sticky by CSS, not by script.
    expect(CSS).toMatch(/\.site-nav\s*\{[^}]*position:\s*sticky/);
  });

  it('2 — the hero headline and subhead, verbatim', () => {
    expect(PAGE).toContain('What&rsquo;s hiding in your property?');
    expect(PAGE).toMatch(/Hidden utility rights-of-way and maintenance obligations/);
    expect(PAGE).toMatch(/Most homeowners never see them\. Get your free report\./);
  });

  it('3 — two pillars, value and safety', () => {
    expect(PAGE).toContain('Maximize your value');
    expect(PAGE).toContain('Protect your home');
    expect(PAGE).toContain('className="pillars"');
  });

  it('4 — how it works, in three steps', () => {
    expect(PAGE).toContain('className="steps"');
    expect(PAGE).toContain('Enter your address.');
    expect(PAGE).toMatch(/parcel, assessor and hazard data/i);
    expect(PAGE).toContain('Get your free report.');
  });

  it('5 — a trust strip with all four claims', () => {
    expect(PAGE).toContain('className="trust"');
    for (const claim of ['Free for homeowners', 'No account needed', 'We never log your address']) {
      expect(PAGE, `missing: ${claim}`).toContain(claim);
    }
    expect(PAGE).toMatch(/Not legal advice/);
    expect(PAGE).toContain('href="/privacy"');
  });

  it('6 — four FAQ entries', () => {
    expect(PAGE).toContain('className="faq"');
    for (const q of [
      'What is an easement, in plain English?',
      'Is this legal advice?',
      'Do you store my address?',
      'Which areas are covered?',
    ]) {
      expect(PAGE, `missing FAQ: ${q}`).toContain(q);
    }
    expect((PAGE.match(/<details>/g) ?? []).length).toBe(4);
  });

  it('7 — the footer comes from the shared component, not re-declared here', () => {
    // SiteFooter renders from the root layout. A second footer in this file
    // would be the duplication that component exists to prevent.
    expect(PAGE).not.toContain('<footer');
  });
});

describe('the address input is the call to action', () => {
  it('posts straight to the report, with no intermediate step', () => {
    expect(PAGE).toContain('action="/report"');
    expect(PAGE).toContain('name="submitted" value="1"');
  });

  it('asks for an address and nothing else', () => {
    /*
     * THE CHANGE FROM THE PLAIN FRONT DOOR THIS REPLACED. That page asked for
     * an easement type before showing anything, which is a question most
     * arrivals cannot answer and the single biggest reason to leave. The
     * report page still has the picker, with every type and plain labels, so
     * the choice is made in context once there is something on screen.
     */
    for (const field of ['street', 'city', 'state', 'zip']) {
      expect(PAGE, `missing field ${field}`).toContain(`name="${field}"`);
    }
    for (const absent of ['easementType', 'lotAreaSqFt', 'easementAreaSqFt', 'legalCharacter']) {
      expect(PAGE, `${absent} should not be asked on the homepage`).not.toContain(
        `name="${absent}"`,
      );
    }
  });

  it('carries autocomplete hints, since most arrivals are on a phone', () => {
    expect(PAGE).toContain('autoComplete="street-address"');
    expect(PAGE).toContain('autoComplete="postal-code"');
    expect(PAGE).toContain('inputMode="numeric"');
  });

  it('the nav CTA scrolls to the form rather than going somewhere else', () => {
    expect(PAGE).toContain('href="#address"');
    expect(PAGE).toContain('id="address"');
  });
});

describe('the positioning rules', () => {
  it('never uses the word easement in a heading', () => {
    /*
     * THE RULE THE BRIEF IS MOST EXPLICIT ABOUT. Most homeowners do not know
     * the word, and a headline built on it asks the reader to already
     * understand the problem before they are allowed to care about it. The
     * headings describe what is at stake; the word is explained in body copy
     * where it can carry its own definition.
     */
    const headings = PAGE.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/g) ?? [];
    expect(headings.length).toBeGreaterThan(3);
    for (const heading of headings) {
      expect(heading.toLowerCase(), `heading uses "easement": ${heading}`).not.toContain('easement');
    }
    // And a summary is a heading for this purpose — it is what a skimmer reads.
    const summaries = PAGE.match(/<summary>([\s\S]*?)<\/summary>/g) ?? [];
    const inSummaries = summaries.filter((s) => s.toLowerCase().includes('easement'));
    // Exactly one: the FAQ that exists to define the word.
    expect(inSummaries).toHaveLength(1);
    expect(inSummaries[0]).toContain('in plain English');
  });

  it('defines the word in body copy where it first appears', () => {
    expect(PAGE).toMatch(/That right is called an\{' '\}\s*<strong>easement<\/strong>/);
  });

  it('names the safety pillar without fear-mongering', () => {
    // The brief asks for plain language. Naming a specific fire would turn an
    // explanation into a scare, and the duty is the actionable part anyway.
    expect(PAGE).toMatch(/keeping it clear and in repair/i);
    expect(PAGE).toMatch(/risk lands on the people living there/i);
    for (const scare of ['Eaton', 'Palisades', 'burned', 'catastroph', 'devastat']) {
      expect(PAGE.toLowerCase(), `fear-mongering: ${scare}`).not.toContain(scare.toLowerCase());
    }
  });
});

describe('claims the rest of the product has to keep', () => {
  it('reads coverage from the registry rather than naming counties', () => {
    // Hardcoding counties here is how a page ends up claiming coverage that
    // was removed, or omitting one that was added.
    expect(PAGE).toContain('SUPPORTED_COUNTIES');
    expect(PAGE).not.toMatch(/Los Angeles County, Orange County, San Diego County/);
  });

  it('says what an uncovered address still gets', () => {
    // Most visitors are outside the three counties, and a bare list of three
    // reads as "not for you".
    expect(PAGE).toMatch(/any other address in\s*\n?\s*the country still produces a report/i);
  });

  it('collects no email, and says why the waitlist is a mailto', () => {
    /*
     * THE BRIEF ASKED FOR EMAIL CAPTURE ON THE COUNTY WAITLIST, and the
     * privacy page promises there are no email addresses collected on this
     * site. Those cannot both be true. A mailto keeps the promise and still
     * gets the request to a person — so the contradiction is resolved toward
     * the one that was already published.
     */
    // Built from the shared constant, so the literal address is not in source.
    expect(PAGE).toContain('mailto:${CONTACT_EMAIL}');
    expect(CONTACT_EMAIL).toBe('help@safehomevalue.com');
    expect(PAGE).toMatch(/we do not collect email addresses/i);
    expect(PAGE).not.toMatch(/<input[^>]*type="email"/);
    expect(PAGE).not.toMatch(/name="email"/);
  });

  it('uses the product name from one place', () => {
    expect(PAGE).toContain('PRODUCT_NAME');
    expect(PRODUCT_NAME).toBe('SafeHomeValue');
    expect(PAGE).not.toContain('[PRODUCT NAME]');
  });

  it('stays indexable', () => {
    // The opposite of the report, which carries an address in its query string.
    expect(PAGE).not.toContain('searchParams');
    expect(PAGE).not.toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});

describe('no new dependencies', () => {
  it('ships no client JavaScript for the accordion or the nav', () => {
    // Native details/summary and a CSS sticky nav. A hand-rolled accordion
    // would meet the letter of "no new dependencies" and miss the point.
    expect(PAGE).not.toContain("'use client'");
    expect(PAGE).not.toContain('useState');
    expect(PAGE).not.toContain('onClick');
  });
});
