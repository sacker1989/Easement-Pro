/**
 * Parsing a street address into the shape LA County's situs fields use.
 *
 * Field conventions below were read off live records on 2026-07-25, not
 * assumed:
 *   SitusHouseNo   "8321"        house number only
 *   SitusDirection "W"  or " "   SEPARATE from the street name; a single
 *                                space when absent, never null or ""
 *   SitusStreet    "HATTERAS ST" name AND suffix together, abbreviated
 *   SitusUnit      "1"  or " "   distinguishes parcels sharing an address
 *   SitusZIP       "91601-1623"  ZIP+4, so exact 5-digit matching fails
 * Everything is upper case.
 */

export interface ParsedSitusAddress {
  houseNumber: string;
  /** Single-letter directional (N/S/E/W/NE/NW/SE/SW), or null. */
  direction: string | null;
  /** Street name with the suffix abbreviated county-style, e.g. "FAUST AVE". */
  street: string;
  /** Secondary unit designator, or null. */
  unit: string | null;
}

export class UnparseableAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnparseableAddressError';
  }
}

/** USPS suffix spellings → the abbreviation the county stores. */
const STREET_SUFFIXES: Record<string, string> = {
  AVENUE: 'AVE', AVE: 'AVE', AV: 'AVE',
  BOULEVARD: 'BLVD', BLVD: 'BLVD',
  CIRCLE: 'CIR', CIR: 'CIR',
  COURT: 'CT', CT: 'CT',
  DRIVE: 'DR', DR: 'DR',
  HIGHWAY: 'HWY', HWY: 'HWY',
  LANE: 'LN', LN: 'LN',
  PARKWAY: 'PKWY', PKWY: 'PKWY',
  PLACE: 'PL', PL: 'PL',
  ROAD: 'RD', RD: 'RD',
  SQUARE: 'SQ', SQ: 'SQ',
  STREET: 'ST', ST: 'ST',
  TERRACE: 'TER', TER: 'TER',
  TRAIL: 'TRL', TRL: 'TRL',
  WAY: 'WAY',
};

const DIRECTIONALS: Record<string, string> = {
  N: 'N', NORTH: 'N',
  S: 'S', SOUTH: 'S',
  E: 'E', EAST: 'E',
  W: 'W', WEST: 'W',
  NE: 'NE', NORTHEAST: 'NE',
  NW: 'NW', NORTHWEST: 'NW',
  SE: 'SE', SOUTHEAST: 'SE',
  SW: 'SW', SOUTHWEST: 'SW',
};

/** Secondary-unit designators that introduce a unit token. */
const UNIT_MARKERS = new Set(['UNIT', 'APT', 'APARTMENT', '#', 'STE', 'SUITE', 'NO']);

/**
 * Splits a free-text street line into county situs components.
 *
 * Deliberately conservative: it abbreviates a trailing suffix and lifts a
 * leading directional, but does not attempt to correct misspelled street
 * names. A wrong guess here silently returns another property's parcel, so
 * unmatched input should fail the lookup rather than be coerced into a match.
 */
export function parseSitusAddress(streetLine: string): ParsedSitusAddress {
  const cleaned = streetLine.trim().toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ');
  if (!cleaned) {
    throw new UnparseableAddressError('Street line is empty');
  }

  let tokens = cleaned.split(' ');

  const houseNumber = tokens[0] ?? '';
  if (!/^\d+$/.test(houseNumber)) {
    throw new UnparseableAddressError(
      `Street line must begin with a house number; got "${tokens[0] ?? ''}"`,
    );
  }
  tokens = tokens.slice(1);

  // Trailing unit, e.g. "... ST UNIT 3" or "... ST #3".
  let unit: string | null = null;
  const hashIndex = tokens.findIndex((t) => t.startsWith('#'));
  if (hashIndex !== -1) {
    const inline = tokens[hashIndex]!.slice(1);
    unit = inline || tokens[hashIndex + 1] || null;
    tokens = tokens.slice(0, hashIndex);
  } else {
    const markerIndex = tokens.findIndex((t) => UNIT_MARKERS.has(t));
    if (markerIndex !== -1 && tokens[markerIndex + 1]) {
      unit = tokens[markerIndex + 1]!;
      tokens = tokens.slice(0, markerIndex);
    }
  }

  // Leading directional, but only when something remains to be the street name
  // — "8321 W" alone would otherwise parse to an empty street.
  let direction: string | null = null;
  if (tokens.length > 1 && tokens[0] && DIRECTIONALS[tokens[0]]) {
    direction = DIRECTIONALS[tokens[0]]!;
    tokens = tokens.slice(1);
  }

  if (tokens.length === 0) {
    throw new UnparseableAddressError(`No street name found in "${streetLine}"`);
  }

  // Abbreviate a trailing suffix; leave it alone if unrecognized, since the
  // county may store an unusual name verbatim.
  const lastToken = tokens[tokens.length - 1]!;
  const abbreviated = STREET_SUFFIXES[lastToken];
  if (abbreviated && tokens.length > 1) {
    tokens = [...tokens.slice(0, -1), abbreviated];
  }

  return { houseNumber, direction, street: tokens.join(' '), unit };
}

/** Escapes a literal for use inside a single-quoted Esri SQL string. */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Builds the `where` clause matching this address against the situs fields.
 *
 * ZIP is matched with LIKE because the county stores ZIP+4. Unit is only
 * constrained when the caller supplied one; omitting it deliberately returns
 * every unit at the address so the caller can report the ambiguity rather
 * than silently pricing one condo out of forty.
 */
export function buildSitusWhereClause(parsed: ParsedSitusAddress, zip?: string): string {
  const clauses = [
    `SitusHouseNo='${escapeSqlLiteral(parsed.houseNumber)}'`,
    `SitusStreet='${escapeSqlLiteral(parsed.street)}'`,
  ];

  if (parsed.direction) {
    clauses.push(`SitusDirection='${escapeSqlLiteral(parsed.direction)}'`);
  }
  if (parsed.unit) {
    clauses.push(`SitusUnit='${escapeSqlLiteral(parsed.unit)}'`);
  }
  if (zip) {
    const zip5 = zip.trim().slice(0, 5);
    if (!/^\d{5}$/.test(zip5)) {
      throw new UnparseableAddressError(`"${zip}" is not a 5-digit ZIP`);
    }
    clauses.push(`SitusZIP LIKE '${zip5}%'`);
  }

  return clauses.join(' AND ');
}
