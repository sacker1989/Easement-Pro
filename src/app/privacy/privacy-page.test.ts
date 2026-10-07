import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, NOT_A_SURVEY_LINE, PRODUCT_NAME } from '@/components/site-footer';

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
    for (const promise of [
      'never written to our logs',
      'no accounts, no passwords',
      'Counts, not identities',
      'do not sell, rent, or share',
    ]) {
      expect(PAGE.toLowerCase(), `missing: ${promise}`).toContain(promise.toLowerCase());
    }
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
