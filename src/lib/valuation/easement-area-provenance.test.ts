import { readSource, stripComments } from '@/lib/test-support/source-text';
import { describe, expect, it } from 'vitest';
import {
  areaIsEstablished,
  AREA_FIELD_HINT,
  ASSUMED_AREA_CAVEAT,
  DEFAULT_EASEMENT_AREA_SQ_FT,
  easementAreaProvenance,
  type EasementAreaProvenance,
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
    // The caller falls back to the default for these anyway. Labelling the
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
    const provenance = CODE.indexOf('const areaProvenance =');
    const area = CODE.indexOf('const easementAreaSqFt =');
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
    // the behaviour it described.
    expect(REPORT_PAGE).not.toMatch(/will record that you did/);
  });
});
