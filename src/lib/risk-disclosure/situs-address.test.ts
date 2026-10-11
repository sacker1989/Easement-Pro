import { describe, expect, it } from 'vitest';
import {
  buildSitusWhereClause,
  escapeSqlLiteral,
  parseSitusAddress,
  UnparseableAddressError,
  abbreviateStreetLine,
} from './situs-address';

describe('parseSitusAddress', () => {
  it('abbreviates a spelled-out suffix to the county form', () => {
    // Live record stores "FAUST AVE"; users type "Faust Avenue".
    expect(parseSitusAddress('8321 Faust Avenue')).toEqual({
      houseNumber: '8321',
      direction: null,
      street: 'FAUST AVE',
      unit: null,
    });
  });

  it('lifts a leading directional into its own field', () => {
    // SitusDirection is stored separately from SitusStreet.
    expect(parseSitusAddress('11501 W Hatteras St')).toEqual({
      houseNumber: '11501',
      direction: 'W',
      street: 'HATTERAS ST',
      unit: null,
    });
  });

  it('expands a spelled-out directional', () => {
    expect(parseSitusAddress('11501 West Hatteras Street').direction).toBe('W');
  });

  it('extracts a unit introduced by a marker word', () => {
    expect(parseSitusAddress('11501 W Hatteras St Unit 3')).toEqual({
      houseNumber: '11501',
      direction: 'W',
      street: 'HATTERAS ST',
      unit: '3',
    });
  });

  it('extracts a unit written with a hash, attached or detached', () => {
    expect(parseSitusAddress('11501 W Hatteras St #3').unit).toBe('3');
    expect(parseSitusAddress('11501 W Hatteras St # 3').unit).toBe('3');
  });

  it('strips punctuation and collapses whitespace', () => {
    expect(parseSitusAddress('  8321   Faust  Ave.  ').street).toBe('FAUST AVE');
  });

  it('keeps an unrecognized final token verbatim', () => {
    // The county stores some names without a standard suffix; guessing here
    // would match a different street.
    expect(parseSitusAddress('100 Paseo Del Mar').street).toBe('PASEO DEL MAR');
  });

  it('keeps a lone trailing token as the street name instead of consuming it as a directional', () => {
    // Lifting "W" here would leave an empty street and silently match nothing
    // useful. Treating it as the name yields a lookup that simply finds no
    // parcel, which is the honest outcome for an incomplete address.
    expect(parseSitusAddress('8321 W')).toEqual({
      houseNumber: '8321',
      direction: null,
      street: 'W',
      unit: null,
    });
  });

  it('rejects a line that does not begin with a house number', () => {
    expect(() => parseSitusAddress('Faust Ave')).toThrow(/house number/);
  });

  it('rejects an empty line', () => {
    expect(() => parseSitusAddress('   ')).toThrow(UnparseableAddressError);
  });
});

describe('buildSitusWhereClause', () => {
  it('matches house number and street', () => {
    const where = buildSitusWhereClause(parseSitusAddress('8321 Faust Avenue'));
    expect(where).toBe("SitusHouseNo='8321' AND SitusStreet LIKE 'FAUST AVE%'");
  });

  it('constrains direction and unit only when present', () => {
    const where = buildSitusWhereClause(parseSitusAddress('11501 W Hatteras St Unit 3'));
    expect(where).toContain("SitusDirection='W'");
    expect(where).toContain("SitusUnit='3'");
  });

  it('omits the unit constraint when none was supplied, so ambiguity surfaces', () => {
    const where = buildSitusWhereClause(parseSitusAddress('11501 W Hatteras St'));
    expect(where).not.toContain('SitusUnit');
  });

  it('matches ZIP by prefix because the county stores ZIP+4', () => {
    // SitusZIP is "91601-1623"; an equality test on "91601" finds nothing.
    const where = buildSitusWhereClause(parseSitusAddress('11501 W Hatteras St'), '91601');
    expect(where).toContain("SitusZIP LIKE '91601%'");
  });

  it('accepts a ZIP+4 input by truncating to five digits', () => {
    const where = buildSitusWhereClause(parseSitusAddress('11501 W Hatteras St'), '91601-1623');
    expect(where).toContain("SitusZIP LIKE '91601%'");
  });

  it('rejects a malformed ZIP', () => {
    expect(() => buildSitusWhereClause(parseSitusAddress('8321 Faust Ave'), 'ABCDE')).toThrow(
      /5-digit ZIP/,
    );
  });

  it('escapes quotes so a street name cannot terminate the SQL literal', () => {
    expect(escapeSqlLiteral("O'FARRELL ST")).toBe("O''FARRELL ST");
    const where = buildSitusWhereClause({
      houseNumber: '1',
      direction: null,
      street: "O'FARRELL ST",
      unit: null,
    });
    expect(where).toContain("SitusStreet LIKE 'O''FARRELL ST%'");
  });
});

describe('the audit of all four providers', () => {
  /*
   * WHY THESE EXIST. The county-parcel outcome log went in, San Diego turned
   * out to be folding a pre-direction into the street name, and the obvious
   * question was whether the other parsers had the same class of bug. They
   * did, in three variants, all confirmed against the live layers on
   * 2026-10-11 before any code changed. Every address below is a real parcel.
   */

  describe('a street named for a direction keeps its name', () => {
    /*
     * CONFIRMED LIVE, with rows carrying SitusDirection = ' ' — no direction
     * at all: WEST BLVD (5821, LA 90043), SOUTH ST (803, Glendale), EAST RD
     * (685, La Habra Heights). The parser lifted the first word off each,
     * producing SitusStreet 'BLVD' with SitusDirection 'W', which matched
     * nothing. Every address on those streets returned not-found.
     */
    it.each([
      ['5821 West Blvd', 'WEST BLVD'],
      ['803 South St', 'SOUTH ST'],
      ['685 East Rd', 'EAST RD'],
      ['1200 North Ave', 'NORTH AVE'],
    ])('%s keeps the street name %s', (typed, street) => {
      const parsed = parseSitusAddress(typed);
      expect(parsed.direction).toBeNull();
      expect(parsed.street).toBe(street);
    });

    it('still lifts a direction when a real street name follows it', () => {
      // The case the rule must not break. "BROADWAY" is a name, not a suffix,
      // so NORTH is a direction here — and W HATTERAS ST is the live row this
      // file's other tests use, where the county does store the split.
      expect(parseSitusAddress('123 North Broadway')).toMatchObject({
        direction: 'N',
        street: 'BROADWAY',
      });
      expect(parseSitusAddress('11501 W Hatteras St')).toMatchObject({
        direction: 'W',
        street: 'HATTERAS ST',
      });
    });

    it('abbreviates the direction it does lift', () => {
      expect(parseSitusAddress('123 Southwest Mesa Rd')).toMatchObject({
        direction: 'SW',
        street: 'MESA RD',
      });
    });
  });

  describe('omitting the suffix is not the same as getting it wrong', () => {
    it('matches on a prefix, so a missing suffix still finds the parcel', () => {
      /*
       * SitusStreet holds name and suffix together — "FAUST AVE". The old
       * equality meant "8321 Faust" produced SitusStreet='FAUST' and matched
       * nothing. Confirmed live: 1 row with the suffix, 0 without it.
       */
      const where = buildSitusWhereClause(parseSitusAddress('8321 Faust'));
      expect(where).toContain("SitusStreet LIKE 'FAUST%'");
      expect(where).not.toContain("SitusStreet='FAUST'");
    });

    it('drops LIKE wildcards, which a prefix match would otherwise honour', () => {
      // No street name contains either, and leaving one in turns a stray
      // keystroke into a scan of the whole layer reported as ambiguity.
      const parsed = parseSitusAddress('8321 F%ust_ Ave');
      expect(parsed.street).toBe('FUST AVE');
      expect(buildSitusWhereClause(parsed)).toContain("SitusStreet LIKE 'FUST AVE%'");
    });
  });

  describe('abbreviateStreetLine, for the counties with one combined column', () => {
    /*
     * Orange stores "1251 N ALAMO ST" and Cook stores "233 S WACKER DR" —
     * both confirmed live. Both matched with a prefix LIKE against the whole
     * typed line and neither abbreviated anything, so the spelled-out forms
     * returned zero rows. Tolerating a MISSING suffix was never the same as
     * tolerating a SPELLED one.
     */
    it.each([
      ['1251 North Alamo Street', '1251 N ALAMO ST'],
      ['233 South Wacker Drive', '233 S WACKER DR'],
      ['1251 N Alamo St', '1251 N ALAMO ST'],
      ['1251 n alamo st', '1251 N ALAMO ST'],
      ['8321 Faust Avenue', '8321 FAUST AVE'],
      ['100 East Main Boulevard', '100 E MAIN BLVD'],
    ])('%s becomes %s', (typed, stored) => {
      expect(abbreviateStreetLine(typed)).toBe(stored);
    });

    it('leaves a missing suffix missing, because the prefix LIKE covers it', () => {
      expect(abbreviateStreetLine('1251 N Alamo')).toBe('1251 N ALAMO');
    });

    it('leaves the street name itself alone', () => {
      // A wrong guess inside the name silently returns another property's
      // parcel, so only the two ends are touched.
      expect(abbreviateStreetLine('3741 Paul Jones Ave')).toBe('3741 PAUL JONES AVE');
    });

    it('applies the same direction rule as the split-column parser', () => {
      // "5821 W BLVD" would have been wrong in exactly the way the LA bug was.
      expect(abbreviateStreetLine('5821 West Blvd')).toBe('5821 WEST BLVD');
      expect(abbreviateStreetLine('803 South St')).toBe('803 SOUTH ST');
    });

    it('collapses whitespace and strips punctuation and wildcards', () => {
      expect(abbreviateStreetLine('  233   S.  Wacker  Dr.  ')).toBe('233 S WACKER DR');
      expect(abbreviateStreetLine('233 S Wacker% Dr')).toBe('233 S WACKER DR');
    });

    it('survives degenerate input rather than throwing', () => {
      // This one feeds a LIKE directly, with no parse step to reject input, so
      // it must return something harmless rather than crash a lookup.
      expect(abbreviateStreetLine('')).toBe('');
      expect(abbreviateStreetLine('   ')).toBe('');
      expect(abbreviateStreetLine('233')).toBe('233');
      expect(abbreviateStreetLine('233 ST')).toBe('233 ST');
      /*
       * The first token is taken as the house number, so a line without one
       * is passed through with only the cheap normalisation applied. Asserted
       * because it is a real limit of the function and not an accident: every
       * caller is a county lookup, which needs a house number anyway, and
       * neither 'MAIN STREET%' nor 'MAIN ST%' matches a column that starts
       * with one.
       */
      expect(abbreviateStreetLine('Main Street')).toBe('MAIN STREET');
    });
  });
});
