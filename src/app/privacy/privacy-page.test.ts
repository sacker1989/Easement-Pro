import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, NOT_A_SURVEY_LINE, PRODUCT_NAME } from '@/components/site-footer';
import { visibleCopy } from '@/lib/test-support/source-text';

const PAGE = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const FOOTER = readFileSync(
  new URL('../../components/site-footer.tsx', import.meta.url),
  'utf8',
);
const LAYOUT = readFileSync(new URL('../layout.tsx', import.meta.url), 'utf8');

describe('the privacy page', () => {
  it('carries the required title', () => {
    expect(PAGE).toContain('Privacy Policy — ${PRODUCT_NAME}');
    expect(PRODUCT_NAME).toBe('SafeHomeValue');
  });

  it('states the four promises', () => {
    /*
     * TWO OF THESE WERE REWORDED ON 2026-10-11, and since this page was
     * specified as founder copy verbatim, the reason is recorded rather than
     * absorbed.
     *
     * "never written to our logs" was absolute and the picture is not. It is
     * true of the application — outcome-log.ts takes a closed set of values
     * and will not accept free text — and the address also travels in the
     * page's own URL, which reaches the browser's history and whatever
     * automatic request records a host keeps. The page now says both halves.
     *
     * "Counts, not identities" was simply false when written. Vercel Web
     * Analytics reports location.href when no parameterised route is given,
     * which is what @vercel/analytics/react does, so every report pageview
     * carried the address in its query string. Fixed in
     * components/analytics.tsx the same day; the sentence now describes the
     * stripping instead of asserting the outcome.
     *
     * The PROMISES are unchanged — our records cannot hold the address, and
     * what is measured is counts. Only the overstatement went.
     */
    for (const promise of [
      'built so the address cannot get into them',
      'no accounts and no passwords',
      'We count visits and reports, and that is all',
      'never sell, rent, trade, or share',
    ]) {
      expect(PAGE.toLowerCase(), `missing: ${promise}`).toContain(promise.toLowerCase());
    }
  });

  it('does not restate the overstatements it replaced', () => {
    /*
     * A later edit re-adding either absolute would put the page back out of
     * step with what the code can actually guarantee.
     *
     * Checked against the reader-visible copy, not the raw file: the comments
     * in page.tsx quote the old wording to explain why it went, and a guard
     * that fires on its own explanation is noise. That has now happened
     * often enough in this repo to have its own helper.
     *
     * The METADATA is checked separately below, because stripJsxComments
     * leaves it in — and it is the easiest place for an overstatement to
     * survive a correction, since nobody rereads a meta tag.
     */
    // BOTH COMMENT FORMS. The body uses JSX comments and the metadata block
    // uses a plain one, and the old wording is quoted in each to explain why
    // it went. Neither is visible to a reader, so neither should be scanned.
    const copy = visibleCopy(PAGE);
    expect(copy).not.toContain('never written to our logs');
    expect(copy).not.toContain('Counts, not identities');
  });

  it('keeps the correction out of the search snippet too', () => {
    const description = PAGE.slice(PAGE.indexOf('description:'), PAGE.indexOf('};'));
    expect(description).not.toContain('never written to our logs');
    expect(description).toMatch(/cannot get into them/);
  });

  it('names the analytics provider and what is stripped', () => {
    /*
     * "Privacy-friendly" is not checkable and the reader cannot evaluate it
     * without knowing who receives the data. Naming Vercel, and naming the
     * one measure that makes the claim true, is what turns reassurance into
     * something a reader can verify in their own devtools.
     */
    expect(PAGE).toContain('Vercel Web Analytics');
    expect(PAGE).toMatch(/stripped out of it/);
    expect(PAGE).toMatch(/no cookies at all/i);
  });

  it('admits the address is in the URL', () => {
    // Verified on the live site: the report URL carries street, city and ZIP.
    // A reader who notices that in their address bar, having been told the
    // address is never recorded anywhere, has no way to tell an overstatement
    // from a lie.
    expect(PAGE).toMatch(/travels in this page.{0,12}s own web address/);
    expect(PAGE).toMatch(/browser history|browser&rsquo;s history|own browser history/);
  });

  describe('the county waitlist email', () => {
    it('names the one purpose and rules out every other', () => {
      /*
       * THE SENTENCE THAT TURNS A WAITLIST INTO A MAILING LIST is "we may
       * contact you about our services", and it is not here. The copy binds
       * the address to a single message and names the things it is NOT for,
       * because a purpose stated only in the positive leaves room.
       */
      expect(PAGE).toMatch(/single note when yours is live/i);
      expect(PAGE).toMatch(/No newsletter, no marketing/i);
      expect(PAGE).toMatch(/different purposes and we did not ask you about/i);
    });

    it('says it is optional and changes nothing if declined', () => {
      expect(PAGE).toMatch(/entirely optional/i);
      expect(PAGE).toMatch(/works exactly the same whether or not/i);
    });

    it('rules out selling, renting, trading and sharing by name', () => {
      // "We don't sell your data" is the promise everyone makes and several of
      // these words get around. All four are named.
      for (const verb of ['sell', 'rent', 'trade', 'share']) {
        expect(PAGE.toLowerCase(), `missing verb: ${verb}`).toContain(verb);
      }
      expect(PAGE).toMatch(/not with advertisers, not with\s+data brokers, not with partners/i);
    });

    it('offers deletion without conditions', () => {
      expect(PAGE).toMatch(/delete it at any time/i);
      expect(PAGE).toMatch(/do not have to\s+explain why/i);
    });

    it('keeps the no-linkage claim, which is why the promise is cheap to make', () => {
      // There is nothing to join an email to: the addresses people look up are
      // never stored. That is what makes "not combined with anything else"
      // true rather than aspirational.
      expect(PAGE).toMatch(/nothing else about you/i);
      expect(PAGE).toMatch(/do not store the addresses people look up/i);
    });
  });

  it('says what the tool is not', () => {
    expect(PAGE).toMatch(/not a survey/i);
    expect(PAGE).toMatch(/not an appraisal/i);
    expect(PAGE).toMatch(/not legal advice/i);
  });

  it('uses the real contact address and invents nothing', () => {
    // The placeholder existed to stop an address being made up. It is filled
    // from one constant, so there is no second copy to go stale.
    expect(CONTACT_EMAIL).toBe('help@safehomevalue.com');
    expect(PAGE).toContain('CONTACT_EMAIL');
    expect(PAGE).not.toContain('[CONTACT EMAIL]');
  });

  it('is indexable', () => {
    /*
     * The opposite of /report, and for a concrete reason: a report URL carries
     * the user's street address in its query string, and this page carries
     * nothing. If a noindex ever lands here it has been copied from the wrong
     * template.
     */
    expect(PAGE).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(PAGE).not.toContain('searchParams');
  });
});

describe('the "never logged" claim is backed by the code', () => {
  it('matches what outcome-log.ts actually guarantees', () => {
    /*
     * THIS IS THE ONE PROMISE ON THE PAGE THAT COULD QUIETLY BECOME FALSE.
     *
     * The geocoder is called with the address in the URL, so an upstream error
     * message routinely quotes it. The claim holds because `Outcome.reason` is
     * a closed union rather than a string — `log(err.message)` does not
     * compile. If that type loosens, the page starts lying and nothing else
     * would catch it.
     */
    const log = readFileSync(
      new URL('../../lib/observability/outcome-log.ts', import.meta.url),
      'utf8',
    );
    const outcomeBlock = log.slice(
      log.indexOf('export interface Outcome'),
      log.indexOf('/** Where a record goes'),
    );
    expect(outcomeBlock).toContain('reason?: FailureReason');
    expect(outcomeBlock).not.toMatch(/\b(message|detail|address|url)\s*\??\s*:\s*string/);
  });
});

describe('the site footer', () => {
  it('renders from the root layout, so every page carries it', () => {
    expect(LAYOUT).toContain('<SiteFooter />');
  });

  it('links to privacy, shows the contact address, and states the limit', () => {
    expect(FOOTER).toContain('href="/privacy"');
    expect(FOOTER).toContain('CONTACT_EMAIL');
    expect(FOOTER).toContain('NOT_A_SURVEY_LINE');
    expect(NOT_A_SURVEY_LINE).toMatch(/not a survey, appraisal, or legal opinion/i);
  });

  it('is the single source for the name, the address and the limit line', () => {
    // Two briefs call for the same three strings. A footer duplicated per page
    // is a footer that says different things on different pages within a
    // month, so they are exported from one module and imported everywhere.
    expect(FOOTER).toContain('export const PRODUCT_NAME');
    expect(FOOTER).toContain('export const CONTACT_EMAIL');
    expect(FOOTER).toContain('export const NOT_A_SURVEY_LINE');
  });

  it('has no leftover placeholder anywhere', () => {
    for (const source of [PAGE, FOOTER]) {
      expect(source).not.toContain('[CONTACT EMAIL]');
      expect(source).not.toContain('[PRODUCT NAME]');
    }
  });
});
