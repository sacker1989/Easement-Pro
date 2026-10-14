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
    // And skips both sources entirely when there is no ring to measure
    // against — neither Overpass nor the county layer can produce a tier
    // without a boundary, so neither is paid for.
    expect(SECTION).toMatch(/if \(geometry\.kind !== 'ring'\)/);
    const earlyReturn = SECTION.slice(SECTION.indexOf("geometry.kind !== 'ring'"));
    expect(earlyReturn.slice(0, 200)).toMatch(/'no-parcel-geometry'/);
  });

  it('queries the county’s own layers as well as OpenStreetMap', () => {
    /*
     * Near four parcels in unincorporated Lakeside, OSM returned zero
     * features and San Diego County's sewer layer returned 22 to 29, each
     * with a diameter, a material and a facility id. The county source is
     * what makes this section say something rather than "nothing mapped".
     */
    const body = SECTION.slice(SECTION.indexOf('async function scan('));
    expect(body).toContain('lookupCountyUtilities');
    expect(body).toContain('lookupInfrastructure');
  });
});

describe('county coverage is stated, because absence is ambiguous', () => {
  /*
   * ABSENCE INSIDE A SERVICE AREA AND ABSENCE OUTSIDE ONE look identical in a
   * query result and mean opposite things. San Diego County DPW serves county
   * service areas; El Cajon runs its own sewers and is simply not in that
   * layer. A reader in a city told "the county found no sewer" may hear
   * "there is no sewer here".
   */
  it('renders the coverage note when a county source found nothing', () => {
    expect(SECTION).toContain('coverageNotes.map');
  });

  it('attributes findings that came from the county', () => {
    // A reader weighing a finding should be able to tell a county's record of
    // its own pipes from a volunteer map; the next step differs too, since a
    // facility id is something you can ring the county about.
    expect(SECTION).toContain('outcome.publishers');
    expect(SECTION).toMatch(/record of its own network/);
  });

  it('lets one source survive the other failing', () => {
    /*
     * A county outage must not look like an empty street, and an Overpass
     * outage must not hide county data. The merge takes whichever answered.
     */
    const body = SECTION.slice(SECTION.indexOf('const merged'));
    expect(body.slice(0, 400)).toMatch(/county\.kind === 'found'/);
    expect(body.slice(0, 400)).toMatch(/nearby\.kind === 'found'/);
  });
});

describe('two sources, two outcomes, neither swallowing the other', () => {
  /*
   * CAUGHT ON PRODUCTION, not in review. A city address in El Cajon: the
   * county layer answered cleanly with nothing — it does not serve that
   * area — and OpenStreetMap was down. The reader saw only "the scan did not
   * complete", which threw away the more useful half. The county DID answer,
   * and it can say why it has nothing there.
   */
  it('shows the county coverage note even when the other source failed', () => {
    const failedBranch = SECTION.slice(SECTION.indexOf("result?.kind === 'lookup-failed'"));
    expect(failedBranch.slice(0, 1200)).toContain('coverageNotes.map');
  });

  it('shows it when nothing was mapped too', () => {
    const emptyBranch = SECTION.slice(SECTION.indexOf("result?.kind === 'none-mapped'"));
    expect(emptyBranch.slice(0, 1400)).toContain('coverageNotes.map');
  });
});
