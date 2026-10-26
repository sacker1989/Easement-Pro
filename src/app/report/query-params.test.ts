import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from '@/lib/easements/easement-types';
import { resolveStateCode } from '@/lib/parcel-resolution/us-states';
import { codeOf } from '@/lib/test-support/source-text';

const PAGE_CODE = codeOf(new URL('./page.tsx', import.meta.url));

/**
 * Query parameters are user input, and this page is where they stop being so.
 *
 * Both bugs below were live HTTP 500s on production, found by probing the
 * report with awkward values. Neither needed a hostile user: one is what a
 * browser's own autofill produces, and the other is any stale or edited link.
 */
describe('the state parameter cannot crash the report', () => {
  it('resolves a full state name, which is what autofill fills in', () => {
    /*
     * The field carries autoComplete="address-level1". Browsers routinely
     * complete that with "California" rather than "CA", and the page passed
     * it to analyzeEasementAt — whose contract is a two-letter code, and
     * which throws UnsupportedStateRuleSetError on anything else. It was
     * right about its contract; the page was the programmer error it names.
     */
    expect(resolveStateCode('California')).toBe('CA');
    expect(resolveStateCode('california')).toBe('CA');
    expect(resolveStateCode('  New   York  ')).toBe('NY');
    expect(resolveStateCode('District of Columbia')).toBe('DC');
  });

  it('passes through a code that is already a code', () => {
    expect(resolveStateCode('CA')).toBe('CA');
    expect(resolveStateCode('ca')).toBe('CA');
    expect(resolveStateCode('il')).toBe('IL');
  });

  it('returns null for anything that is not a state', () => {
    /*
     * NULL RATHER THAN A SUBSTITUTE. A library that quietly picked a state
     * would be choosing a body of law for the reader, which is the one thing
     * this product must not do by accident. The caller decides the fallback.
     */
    for (const junk of ['ZZZZ', '../../etc/passwd', '', '   ', 'Californ', 'XX']) {
      expect(resolveStateCode(junk), `should not resolve: ${junk}`).toBeNull();
    }
    expect(resolveStateCode(undefined)).toBeNull();
  });

  it('the page resolves before using, rather than trusting the query string', () => {
    expect(PAGE_CODE).toMatch(/const state = resolveStateCode\(param\(searchParams\.state\)\)/);
    // The raw parameter must not reach a consumer directly.
    expect(PAGE_CODE).not.toMatch(/const state = param\(searchParams\.state\)/);
  });
});

describe('the easement type parameter cannot crash the report', () => {
  it('is validated once, not at one of seven call sites', () => {
    /*
     * HALF-VALIDATED IS WORSE THAN NOT AT ALL, and this is what that looks
     * like. A conditional guarded `typeMapping` and nothing else, so the
     * unvalidated value still reached responsibilitiesFor, whatShouldExist,
     * buildRemedyPlan, buildFireSafetyContent, buildFloodVulnerabilityContent
     * and the picker's defaultValue. `?easementType=anything` returned 500 on
     * "Cannot read properties of undefined (reading 'heading')".
     *
     * Validating at the boundary makes the other six call sites correct by
     * construction rather than by each remembering.
     */
    expect(PAGE_CODE).toMatch(/const easementType: EasementType = EASEMENT_TYPES\.includes/);
    // The old shape: a cast straight from the query string.
    expect(PAGE_CODE).not.toMatch(
      /const easementType = \(param\(searchParams\.easementType\)[^)]*\) as EasementType/,
    );
  });

  it('no longer needs a second fallback at the mapping', () => {
    // With the value validated above, mapEasementTypeToPurpose is total. The
    // duplicated ternary was the tell that validation was in the wrong place.
    expect(PAGE_CODE).toMatch(/const typeMapping = mapEasementTypeToPurpose\(easementType\)/);
  });

  it('falls back to a type that actually exists', () => {
    expect(EASEMENT_TYPES).toContain('utility-overhead');
  });
});

describe('a county that publishes no lot area does not lose its report', () => {
  /*
   * LIVE ON PRODUCTION, AND THE WORST KIND: not a crash, not a wrong number,
   * but the whole report replaced by a sentence that was itself nonsense.
   *
   * The providers return 0 for a lot area the county does not publish. The
   * page read it with `??`, which accepts 0 as a value, then compared the
   * easement area against it: 800 > 0, so it concluded the easement was
   * larger than the parcel and rendered "Easement area (800 sq ft) exceeds
   * this parcel's actual lot area of 0 sq ft" instead of building anything.
   * 92,118 of Cook County's 1,865,928 parcels publish no LANDSF.
   *
   * These are source assertions because the condition they guard is a line of
   * arithmetic in a server component, and the thing that must not come back
   * is the operator.
   */
  it('requires a positive area, not merely a non-null one', () => {
    expect(PAGE_CODE).toMatch(/typeof n === 'number' && Number\.isFinite\(n\) && n > 0/);
    expect(PAGE_CODE).toMatch(/measuredArea\(unified\?\.lotAreaSqFt\)/);
    expect(PAGE_CODE).toMatch(/measuredArea\(valuation\?\.lotAreaSqFt\)/);
  });

  it('no longer reads either area with ?? alone', () => {
    // The specific expression that shipped the bug.
    expect(PAGE_CODE).not.toMatch(/unified\?\.lotAreaSqFt \?\?/);
  });

  it('falls through to the typed area so a report is still built', () => {
    expect(PAGE_CODE).toMatch(/\?\? typedLotAreaSqFt/);
  });

  it('does not print an unpublished area or value as a figure', () => {
    // Two panels rendered "0 sq ft" and "$0" as though they were
    // measurements: the parcel panel and the short-version summary.
    expect(PAGE_CODE).toMatch(/unified\.lotAreaSqFt > 0/);
    expect(PAGE_CODE).toMatch(/unified\.landValue > 0/);
    expect(PAGE_CODE).toMatch(/not published for this parcel/);
    expect(PAGE_CODE).toMatch(/lot area not published/);
  });

  it('does not scale the diagram off an unpublished area', () => {
    /*
     * effectiveLotArea sets the lot's side length in the diagram and the
     * denominator of easementFraction. A zero made the easement render as the
     * entire lot — a picture of a total taking, drawn from a missing field.
     */
    /*
     * REWRITTEN 2026-10-25. The diagram now reads the single hoisted
     * resolvedLotAreaSqFt rather than its own private expression, because
     * having two sources is what let the diagram draw the 8,000 sq ft form
     * default against a county lot of 3,184 on Newport Beach. The invariant
     * is unchanged and is what this still checks: every source feeding the
     * diagram passes through measuredArea, which rejects the 0 that providers
     * publish for "no area given".
     */
    expect(PAGE_CODE).toMatch(/effectiveLotArea = resolvedLotAreaSqFt \?\?/);
    expect(PAGE_CODE).toMatch(/resolvedLotAreaSqFt = lotAreaSqFt/);
    expect(PAGE_CODE).toMatch(
      /const lotAreaSqFt =\s*\n\s*measuredArea\(unified\?\.lotAreaSqFt\) \?\? measuredArea\(valuation\?\.lotAreaSqFt\)/,
    );
  });

  it('does not pass an unpublished area into the valuation estimate', () => {
    expect(PAGE_CODE).not.toMatch(/lotAreaSqFt: unified\?\.lotAreaSqFt \?\?/);
  });
});

describe('the lot area row says whose lot it is', () => {
  /*
   * A row headed "Lot area" reads as the reader's own lot, whatever a caveat
   * further down the page says. For a condominium unit the figure is the
   * whole development's — every parcel in Orange's 930-18 book publishes
   * 135,871 sq ft — so the label itself has to carry the distinction.
   */
  it('relabels a shared lot rather than relying on the caveat alone', () => {
    expect(PAGE_CODE).toMatch(/unified\.lotTenure === 'undivided-interest'/);
    expect(PAGE_CODE).toMatch(/Shared lot area \(whole development\)/);
  });

  it('keeps the ordinary label for a whole parcel', () => {
    expect(PAGE_CODE).toMatch(/Lot area \(county geometry\)/);
  });
});

describe('a request that fails validation says so where the reader is looking', () => {
  /*
   * FOUND BY experiments/report-sweep.mjs on 648 San Ysidro Blvd, where San
   * Diego publishes a blank SITUS_COMMUNITY so the sweep sent no city. The
   * page rendered the form again with "city is required" below the
   * easement-type explanation, level with the footer links — 21,000 bytes of
   * page with the one actionable sentence at the bottom of it.
   *
   * The City input carries `required`, so an ordinary submission cannot reach
   * this; it needs a hand-edited or truncated URL. That is narrow, and it is
   * also the path that produced both of this project's live 500s.
   */
  it('renders the error above the form, not below it', () => {
    const alertAt = PAGE_CODE.indexOf('{error && <p role="alert">');
    // The form carries id="address" so the not-found state can link back to
    // it ("check the spelling and try again").
    const formAt = PAGE_CODE.indexOf('<form id="address">');
    expect(alertAt).toBeGreaterThan(-1);
    expect(formAt).toBeGreaterThan(-1);
    expect(alertAt).toBeLessThan(formAt);
  });

  it('puts the coverage notice ABOVE the form, where it gets read', () => {
    /*
     * REVERSED ON 2026-10-25, and the old reasoning is worth keeping: a
     * notice describes the figures below it, so it belonged beside them
     * rather than beside the form.
     *
     * It was still too low. A production sweep on 2026-10-21 returned parcel
     * data for two of nine addresses, and the seven failures read as ordinary
     * reports — the sentence saying the figures were national benchmarks
     * rendered below the fold. A reader who never scrolls to it treats a
     * benchmark as their county's own number, which is the difference between
     * degrading honestly and quietly making something up. That cannot depend
     * on scroll depth.
     */
    const noticeAt = PAGE_CODE.indexOf('{!addressLooksUnreal && lookupNotice && (');
    const formAt = PAGE_CODE.indexOf('<form id="address">');
    expect(noticeAt).toBeGreaterThan(-1);
    expect(noticeAt).toBeLessThan(formAt);
  });

  it('replaces the coverage notice entirely when the address is not real', () => {
    // "Figures below use national benchmarks" is the wrong thing to say about
    // a place that may not exist. The two states are mutually exclusive.
    expect(PAGE_CODE).toContain('{addressLooksUnreal && (');
    expect(PAGE_CODE).toContain('{!addressLooksUnreal && lookupNotice && (');
  });

  it('requires BOTH sources to miss before calling an address unreal', () => {
    /*
     * The Census geocoder interpolates along published address ranges and
     * genuinely misses real places — new construction, rural routes, recently
     * annexed streets. Blocking on it alone turns away people whose addresses
     * are fine. The county is the stronger witness: a matched parcel means the
     * address exists whatever Census thinks.
     */
    expect(PAGE_CODE).toMatch(/geocodeMissed && !parcelConfirmed/);
  });

  it('renders the error exactly once', () => {
    // Showing it in two places is worse than showing it in the wrong one.
    const count = PAGE_CODE.split('{error && <p role="alert">').length - 1;
    expect(count).toBe(1);
  });
});
