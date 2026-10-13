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
