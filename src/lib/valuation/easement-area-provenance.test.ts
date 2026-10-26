import { readSource, stripComments } from '@/lib/test-support/source-text';
import { describe, expect, it } from 'vitest';
import {
  areaIsEstablished,
  AREA_FIELD_HINT,
  ASSUMED_AREA_CAVEAT,
  DEFAULT_EASEMENT_AREA_SQ_FT,
  easementAreaProvenance,
  type EasementAreaProvenance,
  assumedAreaFromLot,
  assumedFromLotCaveat,
  ASSUMED_STRIP_WIDTH_FT,
} from './easement-area-provenance';

// readSource normalises CRLF, which this checkout produces and every pattern
// below is written without.
const REPORT_PAGE = readSource(new URL('../../app/report/page.tsx', import.meta.url));

describe('reading the provenance off the query string', () => {
  it('treats a missing value as assumed, which is the homepage funnel', () => {
    /*
     * THE CASE THAT MATTERS MOST. The marketing homepage asks for an address
     * and nothing else — that was the brief, and it is the hero call to action
     * — so it posts no easement area at all. Every visitor arriving that way
     * lands here.
     */
    expect(easementAreaProvenance(undefined)).toBe('assumed-default');
  });

  it('treats a blank field as assumed, because empty is not an estimate', () => {
    expect(easementAreaProvenance('')).toBe('assumed-default');
    expect(easementAreaProvenance('   ')).toBe('assumed-default');
  });

  it('treats unusable input as assumed rather than refusing the report', () => {
    // The caller falls back to the default for these anyway. Labeling the
    // figure is more use to the reader than withholding it.
    for (const raw of ['abc', '0', '-50', 'NaN', 'Infinity']) {
      expect(easementAreaProvenance(raw), `raw: ${raw}`).toBe('assumed-default');
    }
  });

  it('treats a real number as the homeowner own estimate', () => {
    expect(easementAreaProvenance('500')).toBe('user-estimate');
    expect(easementAreaProvenance(' 1200 ')).toBe('user-estimate');
    // Including one that happens to equal the placeholder: they typed it.
    expect(easementAreaProvenance(String(DEFAULT_EASEMENT_AREA_SQ_FT))).toBe('user-estimate');
  });
});

describe('nothing in this product establishes the easement area', () => {
  it('is false for both provenances, because neither is a measurement', () => {
    /*
     * The step this gates reads "Establish the encumbered area properly ... a
     * guess here propagates into every figure downstream". A placeholder is
     * not established. Neither is a number the form invites the reader to
     * guess at — telling them to go and find out is the entire point of the
     * step, so it must survive their guess.
     */
    const all: EasementAreaProvenance[] = ['assumed-default', 'user-estimate'];
    for (const p of all) {
      expect(areaIsEstablished(p), `provenance: ${p}`).toBe(false);
    }
  });
});

describe('the report page cannot go back to asking the parcel match', () => {
  /*
   * THE DEFECT, GUARDED. `buildRemedyPlan` was called with `areaEstablished:
   * unified !== null` — the county PARCEL match. A parcel match establishes
   * the LOT area from county geometry and says nothing about the easement
   * footprint, so the "go and measure it" step was suppressed exactly where
   * the county data was good, and kept where it was not. Measured on the live
   * build before the fix: present with no parcel, absent with one.
   *
   * Source-text, for the reason page-ordering.test.ts gives: this is a server
   * component that reaches live services.
   */
  // Comments in the page quote the old expression to explain it. A guard that
  // fires on its own explanation is noise, so they are stripped first.
  const CODE = stripComments(REPORT_PAGE);

  it('derives areaEstablished from the provenance helper', () => {
    expect(CODE).toContain('areaEstablished: areaIsEstablished(areaProvenance)');
  });

  it('never ties it to the parcel match or any other lookup state', () => {
    const call = CODE.slice(CODE.indexOf('areaEstablished:'));
    const value = call.slice(0, call.indexOf('\n'));
    for (const wrong of ['unified', 'valuation', 'lookup', 'true']) {
      expect(value, `areaEstablished must not read ${wrong}`).not.toContain(wrong);
    }
  });

  it('reads the provenance before the default is substituted', () => {
    /*
     * Once 800 has been filled in, the two cases are indistinguishable — which
     * is why the provenance is computed from the raw query value and the area
     * is derived from the provenance, not the other way round. Anchored on the
     * two declarations rather than on the first mention of each name, since
     * both names also appear in the import block at the top of the file.
     */
    // `let` since 2026-10-25: once a county lot area is known, the assumed
    // area is re-derived as a share of it rather than staying the flat 800.
    // The ordering this test exists for is unchanged — provenance is still
    // read from the raw query value, before any default is substituted.
    const provenance = CODE.indexOf('const areaProvenance =');
    const area = CODE.indexOf('let easementAreaSqFt =');
    expect(provenance).toBeGreaterThan(-1);
    expect(area).toBeGreaterThan(provenance);
  });
});

describe('the assumption is disclosed where the figures are', () => {
  it('names the placeholder and says the figures scale with it', () => {
    expect(ASSUMED_AREA_CAVEAT).toContain('800');
    expect(ASSUMED_AREA_CAVEAT).toMatch(/placeholder, not a measurement/);
    expect(ASSUMED_AREA_CAVEAT).toMatch(/halves them/);
    // It has to tell the reader what to do about it, not only that it is so.
    expect(ASSUMED_AREA_CAVEAT).toMatch(/Enter your own/);
  });

  it('renders beside both dollar figures, not once at the top', () => {
    /*
     * Two figures on one page already risk reading as corroboration. If only
     * the screening range carried the assumption, the IRWA estimate would look
     * like the independent check it is not — both multiply the same area.
     */
    expect((REPORT_PAGE.match(/ASSUMED_AREA_CAVEAT/g) ?? []).length).toBeGreaterThanOrEqual(2);

    const screening = REPORT_PAGE.indexOf('screening.range.derivation');
    const irwa = REPORT_PAGE.indexOf('Land value from:');
    expect(REPORT_PAGE.indexOf('ASSUMED_AREA_CAVEAT', screening)).toBeGreaterThan(screening);
    expect(REPORT_PAGE.indexOf('ASSUMED_AREA_CAVEAT', irwa)).toBeGreaterThan(irwa);
    // Inside the screening panel, before the disclosures that follow it.
    expect(REPORT_PAGE.indexOf('ASSUMED_AREA_CAVEAT', screening)).toBeLessThan(
      REPORT_PAGE.indexOf('The three limits on this number'),
    );
  });

  it('shows it only when the area really was assumed', () => {
    // A homeowner who supplied an area must not be told it was a placeholder.
    const guards = REPORT_PAGE.match(/areaProvenance === 'assumed-default'/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it('leaves the form field empty rather than prefilling the placeholder', () => {
    /*
     * HOW THE ASSUMPTION STAYED INVISIBLE. `defaultValue={800}` put the
     * placeholder in the box as though the reader had typed it, so the field
     * agreed with the figure and nothing marked it as unanswered.
     */
    const field = REPORT_PAGE.slice(REPORT_PAGE.indexOf('Easement area (sq ft)'));
    const input = field.slice(0, field.indexOf('</label>'));
    expect(input).toContain('placeholder');
    expect(input).toMatch(/areaProvenance === 'assumed-default'/);
  });

  it('tells the reader at the field what blank means', () => {
    expect(AREA_FIELD_HINT).toContain('800');
    expect(AREA_FIELD_HINT).toMatch(/next to every figure/);
    expect(REPORT_PAGE).toContain('AREA_FIELD_HINT');
  });

  it('no longer promises to record a guess it was not recording', () => {
    // The old copy said "put your best guess; the report will record that you
    // did" — and nothing recorded it. The claim is gone, and the provenance is
    // the behavior it described.
    expect(REPORT_PAGE).not.toMatch(/will record that you did/);
  });
});

describe('the assumed area derives from the matched lot, as a strip', () => {
  it('lands near the old flat default at the old default lot', () => {
    /*
     * The check that this REINTERPRETS the existing assumption rather than
     * introducing a louder one. 8,000 sq ft was the form's default lot and
     * 800 sq ft the flat default easement; a 10-foot strip across a square
     * lot that size is 894.
     *
     * Not identical, and the test says 15% rather than pretending otherwise —
     * 894 is 11.8% above 800. The two models answer slightly differently at
     * the one point where both are defined, and that gap is the honest size
     * of the change at residential scale.
     */
    const atOldDefault = assumedAreaFromLot(8_000);
    expect(atOldDefault).toBeGreaterThan(DEFAULT_EASEMENT_AREA_SQ_FT * 0.85);
    expect(atOldDefault).toBeLessThan(DEFAULT_EASEMENT_AREA_SQ_FT * 1.15);
  });

  it('grows sub-linearly, because a strip scales with frontage not area', () => {
    /*
     * THE REASON THIS IS NOT A PERCENTAGE. The first fix took 10% of the
     * matched lot — right at residential scale, and it comes apart above it,
     * because doubling a lot's area does not double the boundary a utility
     * runs along. Caught by reading the page for a 108,177 sq ft commercial
     * parcel: 10% gave a 10,818 sq ft easement and a $1.1m figure derived
     * from it. The strip model gives 3,289.
     */
    const small = assumedAreaFromLot(2_502);
    const large = assumedAreaFromLot(108_177);
    expect(large / small).toBeLessThan((108_177 / 2_502) / 4);
    expect(large).toBeLessThan(108_177 * 0.05);
  });

  it('never exceeds the lot it came from', () => {
    for (const lot of [200, 1_000, 2_502, 8_000, 16_269, 108_177]) {
      expect(assumedAreaFromLot(lot)).toBeLessThan(lot);
    }
  });

  it('survives a degenerate lot area without returning NaN', () => {
    for (const lot of [0, -5]) {
      const a = assumedAreaFromLot(lot);
      expect(Number.isFinite(a)).toBe(true);
      expect(a).toBeGreaterThan(0);
    }
  });

  it('states the width and both areas, so the reader can check it', () => {
    const text = assumedFromLotCaveat(108_177, 3_289);
    expect(text).toContain('3,289');
    expect(text).toContain('108,177');
    expect(text).toContain(`${ASSUMED_STRIP_WIDTH_FT}-foot strip`);
    expect(text).toMatch(/placeholder, not a measurement/);
  });
});
