import { describe, expect, it } from 'vitest';
import {
  buildSitusWhereClause,
  escapeSqlLiteral,
  parseSitusAddress,
  UnparseableAddressError,
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
    expect(where).toBe("SitusHouseNo='8321' AND SitusStreet='FAUST AVE'");
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
    expect(where).toContain("SitusStreet='O''FARRELL ST'");
  });
});
