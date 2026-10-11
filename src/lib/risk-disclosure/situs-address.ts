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
 * Whether a leading direction token is a direction or part of the street name.
 *
 * THE DISTINCTION IS REAL AND IT HAS REAL PARCELS BEHIND IT. Confirmed against
 * the live LA layer on 2026-10-11: "WEST BLVD" (5821, LA 90043), "SOUTH ST"
 * (803, Glendale) and "EAST RD" (685, La Habra Heights) are all street NAMES —
 * their rows carry `SitusDirection = ' '`, meaning no direction at all. Lifting
 * the first word off those produced `SitusStreet = 'BLVD'` with
 * `SitusDirection = 'W'`, which matches nothing, and every one of those
 * addresses returned not-found.
 *
 * THE SIGNAL IS WHAT IS LEFT BEHIND. A street name is never a bare suffix. If
 * taking the direction away leaves exactly one token and that token is a
 * suffix, the first word was the name: "WEST BLVD" keeps WEST, while "NORTH
 * BROADWAY" gives up NORTH because BROADWAY is a name, and "W HATTERAS ST"
 * gives up W because two tokens remain.
 *
 * Shared by `parseSitusAddress` and `abbreviateStreetLine` so the split-column
 * counties and the combined-column counties cannot disagree about it.
 */
function liftsLeadingDirection(tokens: readonly string[]): boolean {
  if (tokens.length < 2) return false;
  if (!DIRECTIONALS[tokens[0]!]) return false;
  const rest = tokens.slice(1);
  return !(rest.length === 1 && STREET_SUFFIXES[rest[0]!] !== undefined);
}

/**
 * Rewrites a typed street line into the form every county actually stores.
 *
 * FOR THE COUNTIES THAT KEEP ONE COMBINED COLUMN — Orange's `SiteAddress` and
 * Cook's `street_address` — where the match is a prefix LIKE against the whole
 * line, so the line itself has to be spelled the county's way.
 *
 * ALL FOUR COUNTIES STORE THE USPS ABBREVIATION, and until now only LA's
 * parser knew the tables. Confirmed live on 2026-10-11: Orange holds "1251 N
 * ALAMO ST" and Cook holds "233 S WACKER DR", so "1251 North Alamo Street" and
 * "233 South Wacker Drive" both returned zero rows — a plain spelling
 * preference, reported to the homeowner as "no parcel found".
 *
 * ONLY THE ENDS ARE TOUCHED. A leading direction and a trailing suffix are
 * abbreviated; the name between them is left exactly as typed, because a wrong
 * guess there silently returns a different property's parcel. Omitting the
 * suffix still works — that is what the prefix LIKE is for — so this only adds
 * the spellings that previously missed.
 */
export function abbreviateStreetLine(streetLine: string): string {
  // `%` and `_` dropped for the reason parseSitusAddress gives: this result
  // goes into a prefix LIKE, and neither character occurs in an address.
  const cleaned = streetLine
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/[%_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') return cleaned;

  const tokens = cleaned.split(' ');
  // The house number is tokens[0] and is never a direction or a suffix.
  const head = tokens.slice(0, 1);
  let rest = tokens.slice(1);
  if (rest.length === 0) return cleaned;

  if (liftsLeadingDirection(rest)) {
    rest = [DIRECTIONALS[rest[0]!]!, ...rest.slice(1)];
  }

  const last = rest[rest.length - 1]!;
  const abbreviated = STREET_SUFFIXES[last];
  if (abbreviated !== undefined && rest.length > 1) {
    rest = [...rest.slice(0, -1), abbreviated];
  }

  return [...head, ...rest].join(' ');
}

/**
 * Splits a free-text street line into county situs components.
 *
 * Deliberately conservative: it abbreviates a trailing suffix and lifts a
 * leading directional, but does not attempt to correct misspelled street
 * names. A wrong guess here silently returns another property's parcel, so
 * unmatched input should fail the lookup rather than be coerced into a match.
 */
export function parseSitusAddress(streetLine: string): ParsedSitusAddress {
  /*
   * `%` AND `_` ARE DROPPED because the street now goes into a LIKE pattern.
   * No street name contains either, and leaving them in would turn a stray
   * keystroke into a wildcard scan of the whole layer — "8321 F%" matching
   * every F street at that number and reporting it as ambiguity. Removed
   * rather than escaped: Esri's bracket form is SQL-Server syntax and these
   * layers do not all share a backend.
   */
  const cleaned = streetLine
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/[%_]/g, '')
    .replace(/\s+/g, ' ');
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

  /*
   * Leading directional — but only when the first word really is one. See
   * `liftsLeadingDirection`: "8321 W" alone would parse to an empty street,
   * and "5821 WEST BLVD" is a street named WEST, not BLVD out west.
   */
  let direction: string | null = null;
  if (liftsLeadingDirection(tokens)) {
    direction = DIRECTIONALS[tokens[0]!]!;
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
 * STREET IS A PREFIX LIKE, NOT AN EQUALITY, and that was a defect worth the
 * change. `SitusStreet` holds the name and the suffix together — "FAUST AVE" —
 * so `SitusStreet = 'FAUST'` matched nothing, and a homeowner who typed "8321
 * Faust" instead of "8321 Faust Ave" was told no parcel exists. Confirmed
 * against the live layer on 2026-10-11: the equality returns 1 row with the
 * suffix and 0 without it.
 *
 * San Diego and Orange already matched this way, and the reasoning they give
 * applies here unchanged: over-matching surfaces as `ambiguous` and sends the
 * caller to the disambiguation screen, which is a worse experience than an
 * exact hit and a far better one than a false negative. "FAUST%" reaching a
 * hypothetical FAUSTINA AVE costs one extra click; the equality cost the
 * lookup entirely.
 *
 * ZIP is matched with LIKE because the county stores ZIP+4. Unit is only
 * constrained when the caller supplied one; omitting it deliberately returns
 * every unit at the address so the caller can report the ambiguity rather
 * than silently pricing one condo out of forty.
 */
export function buildSitusWhereClause(parsed: ParsedSitusAddress, zip?: string): string {
  const clauses = [
    `SitusHouseNo='${escapeSqlLiteral(parsed.houseNumber)}'`,
    `SitusStreet LIKE '${escapeSqlLiteral(parsed.street)}%'`,
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
