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
    expect(PAGE_CODE).toMatch(/effectiveLotArea = measuredArea\(valuation\?\.lotAreaSqFt\)/);
  });

  it('does not pass an unpublished area into the valuation estimate', () => {
    expect(PAGE_CODE).not.toMatch(/lotAreaSqFt: unified\?\.lotAreaSqFt \?\?/);
  });
});
