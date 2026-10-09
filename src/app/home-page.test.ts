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

  it('2 — the hero headline, verbatim', () => {
    // Founder copy, exact. Four beats then the ask.
    expect(PAGE).toMatch(
      /Hidden risks\. Silent damage\. Thousands in lost value\. What&rsquo;s hiding on your\s+property\? Get your free home report\./,
    );
  });

  it('2 — search first: the input precedes the explanatory copy', () => {
    /*
     * THE STRUCTURAL REQUIREMENT, not a styling one. Zillow/Redfin layout —
     * someone who already knows what they want acts without reading a
     * paragraph, and the explanation is there for everyone else, below. An
     * explanatory paragraph above the input taxes exactly the people most
     * ready to convert, so the ordering is asserted rather than trusted.
     */
    const headline = PAGE.indexOf('Hidden risks. Silent damage.');
    const form = PAGE.indexOf('className="hero-form"');
    const explainer = PAGE.indexOf('className="hero-sub"');

    expect(headline).toBeGreaterThan(-1);
    expect(form).toBeGreaterThan(headline);
    expect(explainer).toBeGreaterThan(form);
  });

  it('2 — the explainer no longer repeats the headline’s CTA', () => {
    // The headline now ends "Get your free home report." The paragraph below
    // used to end "Get your free report." Two lines apart that reads as a
    // stutter, not emphasis.
    const sub = PAGE.slice(PAGE.indexOf('className="hero-sub"'));
    expect(sub.slice(0, 400)).toMatch(/Most homeowners never see them\./);
    expect(sub.slice(0, 400)).not.toMatch(/Get your free report\./);
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

  it('binds the waitlist email to one purpose, matching the privacy page', () => {
    /*
     * THE PRIVACY PAGE NOW PERMITS THIS, narrowly — one message when the
     * county goes live, never sold, deletable on request. Whatever the
     * homepage says about it has to be the same promise in shorter words, or
     * a reader who checks finds two different answers and believes the weaker
     * one.
     */
    // Built from the shared constant, so the literal address is not in source.
    expect(PAGE).toContain('mailto:${CONTACT_EMAIL}');
    expect(CONTACT_EMAIL).toBe('help@safehomevalue.com');
    expect(PAGE).toMatch(/one thing — a single note when your county goes live/i);
    expect(PAGE).toMatch(/Never\s+sold, never shared, never a newsletter/i);
    expect(PAGE).toMatch(/deleted the moment you ask/i);
    expect(PAGE).toContain('href="/privacy"');
  });

  it('prefills the mailto so the inbox is sortable', () => {
    /*
     * THE MAILBOX IS THE STORE, so the prefill is what makes the rule
     * followable. Free-prose requests arrive as "any chance you'll do Travis
     * County?" and have to be read one at a time; two labelled lines make the
     * pile countable by eye. See docs/waitlist-triage.md.
     */
    expect(PAGE).toContain('subject=${WAITLIST_SUBJECT}&body=${WAITLIST_BODY}');
    expect(PAGE).toContain("'County: \\nState: \\n");
    // Short on purpose — a long template reads as a form in disguise.
    const body = PAGE.match(/const WAITLIST_BODY = encodeURIComponent\(\s*'([^']*)'/)?.[1] ?? '';
    expect(body.length).toBeLessThan(120);
  });

  it('still has no capture form, because there is nowhere to put one', () => {
    /*
     * The copy permits capture; the product cannot yet do it. There is no
     * datastore — the audit store is a file adapter and Vercel's filesystem is
     * ephemeral, so a form would accept an address and drop it at the next
     * cold start, silently. A mailto reaches a real inbox and keeps every
     * promise on the privacy page. This test is the reminder that the gap is
     * storage, not permission.
     */
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
