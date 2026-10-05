import { describe, expect, it } from 'vitest';
import { LA_COUNTY_FALLBACK_DATA } from './la-county-fallback';
import { COUNTY_DATA_MAX_AGE_MONTHS, needsLiveVerification } from './types';

describe('LA_COUNTY_FALLBACK_DATA', () => {
  it('includes the Norwalk HQ with both search rooms and their coverage ranges', () => {
    const norwalk = LA_COUNTY_FALLBACK_DATA.recorderOffices.find((office) =>
      office.name.includes('Norwalk'),
    );
    expect(norwalk).toBeDefined();
    // Room names and coverage updated by the 2026-10-05 verification: the
    // lower level is not published as "LL001", and both now carry the
    // appointment requirement the county added.
    expect(norwalk?.searchRooms.map((r) => r.room)).toEqual([
      'Room 2207 (2nd floor)',
      'Lower level',
    ]);
    expect(norwalk?.searchRooms[0]?.coverage).toContain('1958–present');
    expect(norwalk?.searchRooms[1]?.coverage).toContain('1851–1957');
  });

  it('matches the published copy fee schedule', () => {
    expect(LA_COUNTY_FALLBACK_DATA.copyFeeSchedule).toMatchObject({
      certifiedFirstPage: 6,
      certifiedAdditionalPage: 3,
      firstConformedCopy: 0,
    });
  });

  it('documents the pre/post-1973 grantor/grantee index split', () => {
    const combined = LA_COUNTY_FALLBACK_DATA.indexStructure.join(' ');
    expect(combined).toContain('1973');
    expect(combined).toContain('*');
  });

  it('records when it was last checked against the county, and against what', () => {
    expect(LA_COUNTY_FALLBACK_DATA.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // A date with no sources is an assertion. The URLs are what makes the next
    // re-verification cheap enough to actually happen.
    expect(LA_COUNTY_FALLBACK_DATA.verifiedAgainst.length).toBeGreaterThan(0);
    for (const url of LA_COUNTY_FALLBACK_DATA.verifiedAgainst) {
      expect(url).toMatch(/^https:\/\/(www\.)?lavote\.gov\//);
    }
  });

  it('goes stale on its own rather than staying verified forever', () => {
    const on = LA_COUNTY_FALLBACK_DATA.verifiedOn!;
    expect(needsLiveVerification(LA_COUNTY_FALLBACK_DATA, on)).toBe(false);
    // A month past the horizon. Resolution is deliberately whole months, the
    // same as the counsel-review gate, so "a year and a day" still reads as
    // current. The boolean this replaced could not express the passage of
    // time at all, which is how it stood unchanged while three figures in the
    // record went out of date.
    const stale = new Date(`${on}T00:00:00Z`);
    stale.setUTCMonth(stale.getUTCMonth() + COUNTY_DATA_MAX_AGE_MONTHS + 1);
    expect(needsLiveVerification(LA_COUNTY_FALLBACK_DATA, stale.toISOString().slice(0, 10))).toBe(
      true,
    );
    expect(needsLiveVerification({ verifiedOn: null }, on)).toBe(true);
  });

  describe('the figures the 2026-10-05 verification corrected', () => {
    it('quotes the plain-copy fee a records requester actually pays', () => {
      // The defect that mattered most: the old record implied the first copy
      // was free, which is a recording-time benefit this product's users do
      // not get. They are asking for someone else's recorded easement.
      const fees = LA_COUNTY_FALLBACK_DATA.copyFeeSchedule;
      expect(fees.plainFirstPage).toBe(5);
      expect(fees.plainAdditionalPage).toBe(3);
      expect(fees.certifiedFirstPage).toBe(6);
      expect(fees.notes).toContain('NOT THIS');
    });

    it('charges for a search, which a name-only mail request incurs', () => {
      expect(LA_COUNTY_FALLBACK_DATA.copyFeeSchedule.searchFeePerNamePerYear).toBe(0.5);
      expect(LA_COUNTY_FALLBACK_DATA.copyFeeSchedule.searchFeeMinimum).toBe(1);
    });

    it('tells people to book rather than turn up', () => {
      // Someone acting on the old record would have driven to Norwalk and been
      // turned away at the counter.
      const rooms = LA_COUNTY_FALLBACK_DATA.recorderOffices
        .flatMap((o) => o.searchRooms)
        .map((r) => r.coverage)
        .join(' ');
      expect(rooms).toMatch(/APPOINTMENT/i);
      expect(rooms).toContain('1851');
      expect(rooms).not.toContain('1850');
    });
  });
});
