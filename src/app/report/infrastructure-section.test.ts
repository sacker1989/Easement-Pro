import { describe, expect, it } from 'vitest';
import { readSource, visibleCopy } from '@/lib/test-support/source-text';

const SECTION = readSource(new URL('./infrastructure-section.tsx', import.meta.url));
const PAGE = visibleCopy(readSource(new URL('./page.tsx', import.meta.url)));

/**
 * The scan is streamed rather than awaited, and the reason is measured.
 *
 * Overpass sampled 14 times on 2026-10-14 with the query the report sends:
 * six successes at 1.04–8.05s, eight HTTP 504 failures taking 8.5–13.4s to
 * arrive, and both mirrors dead. It fails more often than it succeeds and a
 * failure is slower than a success — up to 3 seconds added to a ~2 second
 * report, most of the time for nothing.
 */
describe('the scan is off the critical path', () => {
  it('is wrapped in a Suspense boundary rather than awaited in the body', () => {
    expect(PAGE).toMatch(/<Suspense fallback=\{<InfrastructurePending/);
    expect(PAGE).toContain('<InfrastructureSection');
  });

  it('no longer blocks the page body', () => {
    /*
     * The page must not await the scan itself. If this comes back, the report
     * silently re-acquires up to three seconds of latency that nothing in the
     * tests would otherwise notice.
     */
    expect(PAGE).not.toContain('lookupInfrastructure');
    expect(PAGE).not.toContain('fetchParcelGeometry');
    expect(PAGE).not.toContain('assessParcelInfrastructure');
  });

  it('still renders only where a parcel and a geocode both exist', () => {
    // The tier is measured from the county's polygon; without one there is
    // nothing to measure against.
    expect(PAGE).toMatch(/unified !== null && geocoded\?\.kind === 'matched'/);
  });
});

describe('a reader without JavaScript is told, not left spinning', () => {
  it('the pending state carries a noscript explanation', () => {
    /*
     * React streams the resolved section in a <template> and swaps it with an
     * inline script. With JavaScript off that swap never happens and the
     * reader sees "checking…" forever — the waiting-forever failure this
     * product keeps removing. The rest of the report needs no script, so the
     * honest thing is to say that this section does.
     */
    expect(SECTION).toContain('<noscript>');
    const noscript = SECTION.slice(SECTION.indexOf('<noscript>'), SECTION.indexOf('</noscript>'));
    expect(noscript).toMatch(/needs JavaScript/);
    expect(noscript).toMatch(/Everything else in this report is already here/);
  });

  it('says the rest of the report does not depend on it', () => {
    // Whitespace collapsed: the copy is line-wrapped in the source, so a
    // phrase that reads as one sentence is split across lines in the file.
    const noscript = SECTION.slice(
      SECTION.indexOf('<noscript>'),
      SECTION.indexOf('</noscript>'),
    ).replace(/\s+/g, ' ');
    expect(noscript).toMatch(/Nothing below depends on this scan/);
    expect(noscript).toMatch(/deed and your plat remains the authority/);
  });
});

describe('the four outcomes still read differently', () => {
  it('keeps found, none-mapped, failed and no-geometry distinct', () => {
    /*
     * Moving the render into its own component is exactly the kind of change
     * that quietly collapses cases. Found something, found nothing, could not
     * look, and no outline to measure from are four different statements, and
     * any of them rendering as "nothing near this property" would hand a
     * homeowner a clean bill of health from a gap in a volunteer map.
     */
    for (const outcome of ["'assessed'", "'none-mapped'", "'lookup-failed'", "'no-parcel-geometry'"]) {
      expect(SECTION, `missing outcome: ${outcome}`).toContain(outcome);
    }
    expect(SECTION).toContain('COVERAGE_CAVEAT');
    expect(SECTION).toContain('GEOMETRY_IS_NOT_A_DEED');
  });

  it('still fetches geometry before scanning, so the radius means the parcel', () => {
    /*
     * Compared inside the scan function, not across the file: both names
     * also appear in the import block at the top, where their order says
     * nothing about the order of the calls.
     */
    const body = SECTION.slice(SECTION.indexOf('async function scan('));
    const geometryAt = body.indexOf('fetchParcelGeometry');
    const lookupAt = body.indexOf('lookupInfrastructure');
    expect(geometryAt).toBeGreaterThan(-1);
    expect(lookupAt).toBeGreaterThan(geometryAt);
    // And skips Overpass entirely when there is no ring to measure against.
    expect(SECTION).toMatch(/if \(geometry\.kind !== 'ring'\) return \{ kind: 'no-parcel-geometry' \}/);
  });
});
