import { describe, expect, it } from 'vitest';
import { LA_COUNTY_FALLBACK_DATA } from './la-county-fallback';

describe('LA_COUNTY_FALLBACK_DATA', () => {
  it('includes the Norwalk HQ with both search rooms and their coverage ranges', () => {
    const norwalk = LA_COUNTY_FALLBACK_DATA.recorderOffices.find((office) =>
      office.name.includes('Norwalk'),
    );
    expect(norwalk).toBeDefined();
    expect(norwalk?.searchRooms).toEqual(
      expect.arrayContaining([
        { room: 'Room 2207', coverage: '1958–present' },
        { room: 'Room LL001', coverage: '1850–1957' },
      ]),
    );
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

  it('flags itself as needing live verification before launch', () => {
    expect(LA_COUNTY_FALLBACK_DATA.needsLiveVerificationBeforeLaunch).toBe(true);
  });
});
