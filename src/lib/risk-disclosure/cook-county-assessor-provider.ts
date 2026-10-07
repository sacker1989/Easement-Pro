/**
 * PARKED, NOT WIRED — 2026-10-05.
 *
 * This provider is complete and verified against the live service, and
 * nothing dispatches to it. The build brief of 2026-10-05 freezes new
 * geography until after launch and names LA, Orange and San Diego as the
 * covered counties, so the dispatch branch and the Illinois ZIP ranges were
 * written, tested, and then reverted.
 *
 * TURNING IT ON IS FOUR EDITS, all outside this file: add the county to
 * SUPPORTED_COUNTIES and normaliseCountyName in county-dispatch.ts, add a
 * dispatch branch there that sets state IL and carries the assessed-fraction
 * caveat below, and add Illinois ZIP ranges to county-resolver.ts, which is
 * California-only today.
 *
 * It is kept rather than deleted because the expensive part was establishing
 * that Cook publishes a queryable layer carrying assessed land value and land
 * area at all — most counties publish geometry and an identifier and stop
 * there. That finding does not expire.
 */
/**
 * Cook County, Illinois — the first county outside California with live parcel
 * data, and the first assessor on a regime other than Proposition 13.
 *
 * WHY COOK. Five million people, the largest county the product can reach
 * after Los Angeles, and its parcel layer carries everything the report needs:
 * assessed land value, land square footage, address and PIN. Most counties
 * publish geometry and an identifier and stop there, which is useless for a
 * valuation screen.
 *
 * THE FIELD NAMES WERE READ FROM THE SERVICE, not guessed — the layer metadata
 * at .../CookViewer3Parcels/MapServer/0?f=json lists all 70 of them, and a live
 * query confirmed the five this module reads return real values.
 *
 * NO PROPOSITION 13 HERE, AND THAT IS THE SUBSTANTIVE DIFFERENCE. The
 * California providers surface a `landBaseYear` because Prop 13 freezes the
 * assessed value to the year of acquisition, so a roll year of 2026 can
 * describe a 1978 market and the gap is the single most misleading thing about
 * a California assessment. Illinois reassesses on a three-year cycle by
 * township, so the roll year IS roughly the market year and there is no base
 * year to carry. `landBaseYear` is therefore null — correctly, not for want of
 * a field to read.
 *
 * THAT CUTS BOTH WAYS and is worth stating rather than celebrating: a Cook
 * County land value is closer to market than a Los Angeles one, and it is
 * still an ASSESSED value produced for taxation on a cycle, not an appraisal.
 * Illinois also assesses most property at a statutory fraction of market
 * value, which this module does not attempt to undo — see the note on
 * `landValue`.
 */

import type {
  AddressLookupResult,
  AssessorParcelValuation,
  ParcelCandidate,
} from './la-county-assessor-provider';
import { AssessorLookupError } from './la-county-assessor-provider';

export const COOK_COUNTY_PARCEL_LAYER =
  'https://gis12.cookcountyil.gov/traditional/rest/services/CookViewer3Parcels/MapServer/0';

/**
 * Fields read, by their names in the service.
 *
 * Listed as a constant so the query and the parser cannot drift: a field
 * requested but not parsed is waste, and one parsed but not requested is
 * undefined at runtime with no type error.
 */
export const COOK_FIELDS = [
  'PIN14_dash',
  'street_address',
  'CITYNAME',
  'ZIP1',
  'UNITDESC',
  'UNITNO',
  'LANDSF',
  'CURRENTVALUE_LAND',
  'CURRENTVALUE_BLDG',
  'TAXYR',
] as const;

interface EsriQueryResponse {
  error?: { code?: number; message?: string };
  features?: Array<{ attributes: Record<string, unknown> }>;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function blankToNull(value: unknown): string | null {
  const t = text(value);
  return t === '' ? null : t;
}

/** Esri returns numerics as numbers, but nulls are common on exempt parcels. */
function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Escapes a value for an Esri `WHERE` clause.
 *
 * SQL-ISH STRING INTERPOLATION IS WHAT THIS AVOIDS. An apostrophe in a street
 * name — O'Brien Ave, and Chicago has several — terminates the literal and
 * produces an Esri parse error, which surfaces as "no parcel found" for a real
 * address. Doubling it is the SQL-standard escape Esri expects.
 */
export function escapeEsriLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function buildWhere(streetLine: string, zip?: string): string {
  const street = escapeEsriLiteral(streetLine.trim().toUpperCase());
  const clauses = [`UPPER(street_address) LIKE '${street}%'`];
  if (zip !== undefined && zip.trim() !== '') {
    clauses.push(`ZIP1 = '${escapeEsriLiteral(zip.trim())}'`);
  }
  return clauses.join(' AND ');
}

function toValuation(attrs: Record<string, unknown>): AssessorParcelValuation {
  const pin = text(attrs.PIN14_dash);
  const lotAreaSqFt = numberOrZero(attrs.LANDSF);
  const landValue = numberOrZero(attrs.CURRENTVALUE_LAND);

  return {
    // The county's own identifier in both slots. LA distinguishes AIN from
    // APN; Cook has one number and inventing a second formatting of it would
    // imply a distinction the county does not make.
    ain: pin,
    apn: pin,
    situsFullAddress: [text(attrs.street_address), text(attrs.CITYNAME), text(attrs.ZIP1)]
      .filter((p) => p !== '')
      .join(', '),
    /*
     * LANDSF, NOT Shape.STArea().
     *
     * The layer's spatial reference is EPSG:3435 (Illinois State Plane East,
     * US survey feet), so the shape area WOULD already be square feet — the
     * unit trap that caught the Florida work does not bite here. LANDSF is
     * still preferred: it is the assessor's own land figure, which is what the
     * land VALUE is assessed against, so the two are consistent with each
     * other. Shape area measures the polygon, which can differ.
     */
    lotAreaSqFt,
    /*
     * ASSESSED, AND ILLINOIS ASSESSES AT A FRACTION OF MARKET VALUE.
     *
     * Cook County assesses most residential property at a statutory percentage
     * of fair market value rather than at it. This module does NOT scale the
     * figure up, deliberately: the ratio varies by property class and by
     * legislative change, applying one would turn a published number into a
     * derived one, and the derivation would be invisible downstream. The
     * screening estimate already states that it works from assessed values and
     * that an appraiser is what produces market value.
     */
    landValue,
    improvementValue: numberOrZero(attrs.CURRENTVALUE_BLDG),
    rollYear: text(attrs.TAXYR),
    /*
     * NULL BECAUSE ILLINOIS HAS NO PROPOSITION 13, not because the field is
     * missing. Cook reassesses on a three-year township cycle, so the roll
     * year already approximates the market year. A base year here would be
     * fabricating a California concept for a state that does not have one.
     */
    landBaseYear: null,
    landValuePerSqFt: lotAreaSqFt > 0 ? landValue / lotAreaSqFt : 0,
  };
}

function toCandidate(attrs: Record<string, unknown>): ParcelCandidate {
  const unitDesc = blankToNull(attrs.UNITDESC);
  const unitNo = blankToNull(attrs.UNITNO);
  return {
    ain: text(attrs.PIN14_dash),
    situsFullAddress: [text(attrs.street_address), text(attrs.CITYNAME), text(attrs.ZIP1)]
      .filter((p) => p !== '')
      .join(', '),
    unit: [unitDesc, unitNo].filter((p) => p !== null).join(' ') || null,
  };
}

export interface CookCountyAssessorProvider {
  name: string;
  fetchByAin(pin: string): Promise<AssessorParcelValuation | null>;
  findByAddress(streetLine: string, zip?: string): Promise<AddressLookupResult>;
}

export function createCookCountyAssessorProvider(options: {
  fetchImpl?: typeof fetch;
  layerUrl?: string;
} = {}): CookCountyAssessorProvider {
  const doFetch = options.fetchImpl ?? fetch;
  const layer = options.layerUrl ?? COOK_COUNTY_PARCEL_LAYER;

  async function query(where: string, limit: number): Promise<Array<Record<string, unknown>>> {
    const params = new URLSearchParams({
      where,
      outFields: COOK_FIELDS.join(','),
      returnGeometry: 'false',
      resultRecordCount: String(limit),
      f: 'json',
    });

    let payload: EsriQueryResponse;
    try {
      const response = await doFetch(`${layer}/query?${params.toString()}`);
      if (!response.ok) {
        throw new AssessorLookupError(`Cook County parcel service returned HTTP ${response.status}`);
      }
      payload = (await response.json()) as EsriQueryResponse;
    } catch (err) {
      if (err instanceof AssessorLookupError) throw err;
      throw new AssessorLookupError('Cook County parcel service was unreachable', err);
    }

    // Esri answers HTTP 200 with an error body. Treating that as an empty
    // result set would report "no parcel found" for a malformed query, which
    // looks identical to a genuinely absent parcel and hides the bug.
    if (payload.error) {
      throw new AssessorLookupError(
        `Cook County parcel service error: ${payload.error.message ?? 'unspecified'}`,
      );
    }

    return (payload.features ?? []).map((f) => f.attributes);
  }

  return {
    name: 'Cook County Assessor (CookViewer parcels)',

    async fetchByAin(pin) {
      const rows = await query(`PIN14_dash = '${escapeEsriLiteral(pin.trim())}'`, 1);
      return rows[0] === undefined ? null : toValuation(rows[0]);
    },

    async findByAddress(streetLine, zip) {
      if (streetLine.trim() === '') return { status: 'not-found' };

      const rows = await query(buildWhere(streetLine, zip), 25);
      if (rows.length === 0) return { status: 'not-found' };
      if (rows.length === 1) return { status: 'found', valuation: toValuation(rows[0]!) };

      /*
       * AMBIGUOUS RATHER THAN FIRST-MATCH, for the reason the LA provider
       * gives and more so here: Chicago is dense with condo buildings, where
       * one street address yields one PIN per unit. Picking the first would
       * price an arbitrary neighbour's unit and present it as the user's own.
       */
      return { status: 'ambiguous', candidates: rows.map(toCandidate) };
    },
  };
}
