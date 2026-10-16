/**
 * Live Orange County, CA assessor valuation lookup.
 *
 * WHY THIS EXISTS SEPARATELY FROM LA: Orange County's headline parcel service
 * (Map_Layers/Parcels) publishes six fields and no money, which is why an
 * earlier pass recorded the county as having no assessed value at all. That
 * was wrong. The assessment roll is published on the same server under
 * LegalLotsAttributeOpenData, which carries LandVal, ImprovedVal, SiteAddress,
 * SiteZip5 and geometry for roughly 696,000 parcels. Verified against the live
 * endpoint on 2026-07-27.
 *
 * COUNT INSTABILITY: the record count is not stable. Four identical
 * `LandVal IS NOT NULL` count queries seconds apart returned 695,595 /
 * 695,750 / 695,918 / 696,075 — monotonically rising, ~150 per call — against
 * 752,064 total records. The layer is evidently being written while served. An
 * earlier pass recorded 912,332 from a single count query and treated it as a
 * fact; it is not reproducible. Point lookups are unaffected and were stable
 * across five consecutive identical queries, but callers must not treat any
 * aggregate count from this layer as authoritative, and a parcel absent at one
 * moment may appear at another.
 *
 * WHAT IT CANNOT DO: the layer publishes no Proposition 13 base year and no
 * roll year. LA's service publishes Roll_LandBaseYear, which is what lets
 * market-index.ts restate a frozen assessment in present-day terms. Orange
 * County values are equally frozen — two comparable ~6,200 sq ft lots on W
 * Huntington Ave carry land values of 243,414 and 531,538 — but nothing in
 * the data says which year each reflects, so there is no defensible way to
 * index them forward. Values are returned raw, and `landBaseYear` is null to
 * force callers to say so rather than quietly presenting a stale figure as
 * current. See ORANGE_COUNTY_STALENESS_CAVEAT.
 *
 * The two dates the layer does publish (LegalStartDate, DocRefDate) describe
 * when the legal lot was created and when its reference document was
 * recorded. Neither is an assessment base year and neither may be substituted
 * for one. LegalStartDate returns 1972-02-24 for every sampled record, so it
 * is a bulk layer-establishment date rather than a per-parcel event.
 *
 * NO VINTAGE EXISTS ANYWHERE IN THE COUNTY'S PUBLIC GIS. Confirmed 2026-07-27
 * by enumerating all 41 service folders and sweeping every service name for
 * sale/transfer/deed/owner/history/roll/assess/base/year. Comparing roll
 * vintages to detect reassessment was also tested and does not work — the
 * 2020-2021 roll (Treasurer_Tax_Collector/TTC) publishes blank value strings.
 * Do not re-litigate this without new evidence; see docs/spec-easement-valuation.md §3.4.
 *
 * A RICHER LAYER EXISTS: Treasurer_Tax_Collector/Secured_Property_Tax_Information
 * carries 886,542 parcels with alv > 0 (against ~696,000 here), as proper
 * Doubles rather than strings. Migrating is worthwhile but unverified —
 * SiteAddress population was not confirmed before the county server began
 * returning 503. Note its `apn` field is 100% empty; join on AssessmentNo.
 * See spec §3.5.
 *
 * AVAILABILITY: the whole ocgis.com server returned HTTP 503 under modest
 * query load during this work. There is no SLA and no published rate limit.
 * Callers need caching, backoff, and a degraded path — noOpOrangeCountyProvider
 * is the intended fallback shape. See spec §3.6.
 */

import { abbreviateStreetLine } from './situs-address';

const OC_LEGAL_LOTS_QUERY_URL =
  'https://www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0/query';

/** Fields required to derive a per-sq-ft land value. */
export const REQUIRED_FIELDS = [
  'AssessmentNo',
  'SiteAddress',
  'SiteZip5',
  'LandVal',
  'ImprovedVal',
  /*
   * READ ONLY TO ANSWER ONE QUESTION: does this owner hold the whole lot?
   * The legal description is the only field in this layer that says so.
   * LotType is "Lot" for a fee parcel and for a condominium unit alike, and
   * GPLU_DESC, ZC_DESCR and ZCLASS are null on every row sampled.
   */
  'LegalDescr',
] as const;

/**
 * Whether the legal description claims a fraction of a shared lot.
 *
 * THE COUNTY'S OWN WORDS, NOT AN INFERENCE FROM THE APN. Two wordings appear
 * and both carry the fraction:
 *
 *   "LOT 1 OF TRACT 17740 OF CONDO PROJECT 930-18 … TOGETHER WITH AN
 *    UND 1/12 INT IN POR. OF LOT 1"
 *   "TRACT 16899 LOT 7, OF PROJECT 934-74 … TOGETHER WITH AN
 *    UND 1/10 INT IN LOT 7"
 *
 * MATCHING ON "CONDO" ALONE WOULD HAVE MISSED 134,000 PARCELS — only 32,053
 * addressed parcels say CONDO while 166,052 declare an undivided interest.
 * The APN prefix is worse in both directions: 9,305 non-9xx parcels hold a
 * fractional interest and 30,972 9xx parcels do not. An ordinary fee lot
 * reads "P-BOOK: 381 PAGE: 23 PAR: 2" and matches nothing here.
 * Counts measured 2026-10-15.
 */
function declaresUndividedInterest(legalDescr: unknown): boolean {
  return /\bUND\b[^.]{0,40}\bINT\b/i.test(String(legalDescr ?? ''));
}

/**
 * Text for the methodology section wherever an Orange County figure is shown.
 * Stated once here so the report and the letter cannot drift apart on it.
 */
export const ORANGE_COUNTY_STALENESS_CAVEAT =
  'Orange County publishes assessed land values but not the Proposition 13 base ' +
  'year behind them. Under Proposition 13 an assessment reflects the last ' +
  'reassessment rather than the current market, and without a base year there is ' +
  'no way to tell whether this figure is current or decades old, nor to index it ' +
  'forward. Treat it as a floor on land value, not an estimate of it, and confirm ' +
  'with the Orange County Assessor before relying on it in a compensation negotiation.';

export interface OrangeCountyParcelValuation {
  /** County assessment number, e.g. "071-334-14". Serves as the APN. */
  readonly assessmentNo: string;
  readonly siteAddress: string;
  readonly zip: string | null;
  /**
   * Parcel area from Shape.STArea(). The layer's spatial reference is
   * EPSG:2230 (NAD83 California zone 6, US survey feet), so this is already
   * square feet — no unit conversion is applied or needed.
   */
  readonly lotAreaSqFt: number;
  readonly landValue: number;
  readonly improvementValue: number;
  /**
   * Always null. Orange County does not publish a Proposition 13 base year on
   * this layer. Present on the type so callers handle it explicitly instead of
   * assuming a base year exists — see ORANGE_COUNTY_STALENESS_CAVEAT.
   */
  readonly landBaseYear: null;
  /**
   * Derived: landValue / lotAreaSqFt. Reflects an unknown base year.
   *
   * ZERO FOR AN UNDIVIDED INTEREST, where the numerator is one unit's land
   * value and the denominator is the whole development's area.
   */
  readonly landValuePerSqFt: number;
  /** Whether lotAreaSqFt is this owner's lot. See declaresUndividedInterest. */
  readonly lotTenure: 'whole-parcel' | 'undivided-interest';
}

/** Minimal identity for one of several parcels sharing a street address. */
export interface OrangeCountyParcelCandidate {
  readonly assessmentNo: string;
  readonly siteAddress: string;
  readonly zip: string | null;
}

export type OrangeCountyLookupResult =
  | { status: 'found'; valuation: OrangeCountyParcelValuation }
  | { status: 'not-found' }
  | { status: 'ambiguous'; candidates: OrangeCountyParcelCandidate[] };

export interface OrangeCountyAssessorProvider {
  name: string;
  /** Returns null when the parcel is not found. Throws on transport failure. */
  fetchByAssessmentNo(assessmentNo: string): Promise<OrangeCountyParcelValuation | null>;
  /** Resolves a street address to a parcel. Supplying `zip` narrows the match. */
  findByAddress(streetLine: string, zip?: string): Promise<OrangeCountyLookupResult>;
}

export class OrangeCountyLookupError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'OrangeCountyLookupError';
  }
}

interface EsriQueryResponse {
  error?: { code?: number; message?: string };
  features?: Array<{ attributes: Record<string, unknown> }>;
}

/**
 * Parses one of the layer's money fields. They are declared
 * esriFieldTypeString, so a value arrives as "531538" rather than 531538, and
 * absent values arrive as null or "". Returns null for anything unusable
 * rather than coercing to 0 — a zero land value and an unpublished one mean
 * different things.
 */
export function parseMoneyField(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim().replace(/[$,]/g, '');
  if (text === '') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function blankToNull(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text === '' ? null : text;
}

/** Maps a raw Esri attribute bag onto the valuation shape, validating as it goes. */
export function toOrangeCountyParcelValuation(
  attrs: Record<string, unknown>,
): OrangeCountyParcelValuation {
  const lotAreaSqFt = Number(attrs['Shape.STArea()']);
  if (!Number.isFinite(lotAreaSqFt) || lotAreaSqFt <= 0) {
    throw new OrangeCountyLookupError('Assessor record reports a non-positive parcel area');
  }

  /*
   * READ BEFORE THE LAND VALUE IS CHECKED, because a unit's land value is
   * perfectly positive and passes every check below. Nothing about the
   * numbers reveals this; only the legal description does.
   */
  const undivided = declaresUndividedInterest(attrs['LegalDescr']);

  const landValue = parseMoneyField(attrs['LandVal']);
  if (landValue === null) {
    throw new OrangeCountyLookupError('Assessor record publishes no land value');
  }
  if (landValue <= 0) {
    // Exempt and public parcels legitimately carry a zero land value. They
    // cannot support a per-sq-ft derivation, so treat them as unusable rather
    // than emitting a $0/sq ft estimate.
    throw new OrangeCountyLookupError(
      'Assessor record reports a non-positive land value, so no per-sq-ft value can be derived',
    );
  }

  const assessmentNo = blankToNull(attrs['AssessmentNo']);
  if (assessmentNo === null) {
    throw new OrangeCountyLookupError('Assessor record is missing required field "AssessmentNo"');
  }

  return {
    assessmentNo,
    siteAddress: blankToNull(attrs['SiteAddress']) ?? '',
    zip: blankToNull(attrs['SiteZip5']),
    lotAreaSqFt,
    landValue,
    improvementValue: parseMoneyField(attrs['ImprovedVal']) ?? 0,
    landBaseYear: null,
    lotTenure: undivided ? 'undivided-interest' : 'whole-parcel',
    /*
     * THE DIVISION IS REFUSED WHERE THE TWO FIGURES DESCRIBE DIFFERENT
     * THINGS. For a unit in a common-interest development the county
     * publishes a per-unit land value and the whole development's area: all
     * 489 parcels in the 930-18 book carry 135,871.237 sq ft, so
     * 142 Paramount came out at $3.44/sq ft where a fee lot two books away
     * sits at $73. The non-positive result routes into the same refusal that
     * the exempt-parcel branch above uses.
     */
    landValuePerSqFt: undivided ? 0 : landValue / lotAreaSqFt,
  };
}

/**
 * Escapes a string for inclusion in an Esri `where` clause. The clause is
 * assembled as SQL by the remote service, so single quotes are doubled and
 * the LIKE wildcards are neutralised.
 */
export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''").replace(/[%_]/g, (c) => `[${c}]`);
}

/**
 * Assessment numbers are digits and hyphens, e.g. "071-334-14". Reject
 * anything else outright rather than attempting to sanitize.
 */
function assertSafeAssessmentNo(assessmentNo: string): string {
  if (!/^[\d-]{5,22}$/.test(assessmentNo)) {
    throw new OrangeCountyLookupError(
      `"${assessmentNo}" is not a well-formed Orange County assessment number`,
    );
  }
  return assessmentNo;
}

/**
 * Normalises a typed street line to the layer's stored form. Matching is a
 * prefix LIKE so that "1251 N ALAMO" finds "1251 N ALAMO ST" — the county
 * stores a suffix the user may not type. Over-matching surfaces as `ambiguous`
 * rather than a wrong parcel.
 *
 * THE UPPERCASING WAS NOT ENOUGH, which an audit of all four providers found.
 * The county stores the USPS abbreviation — confirmed live on 2026-10-11 as
 * "1251 N ALAMO ST" — so a prefix LIKE built from "1251 North Alamo Street"
 * matched zero rows and the homeowner was told no parcel exists. Tolerating a
 * MISSING suffix was never the same as tolerating a SPELLED one, and the
 * comment above used to imply it was.
 *
 * `abbreviateStreetLine` is shared with Cook, which had the identical gap, and
 * with LA, whose split-column parser is where the abbreviation tables already
 * lived. It also handles the trap in the other direction: "5821 WEST BLVD" is
 * a street named WEST, so its first word is left alone.
 */
export function normalizeSiteAddress(streetLine: string): string {
  return abbreviateStreetLine(streetLine);
}

export interface OrangeCountyProviderOptions {
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Caps how many rows an address query may return before it is ambiguous. */
  maxCandidates?: number;
}

export function createOrangeCountyAssessorProvider(
  options: OrangeCountyProviderOptions = {},
): OrangeCountyAssessorProvider {
  const { timeoutMs = 10_000, fetchImpl = fetch, maxCandidates = 25 } = options;

  return {
    name: 'orange-county-legal-lots',

    async fetchByAssessmentNo(assessmentNo: string): Promise<OrangeCountyParcelValuation | null> {
      const safe = assertSafeAssessmentNo(assessmentNo);

      const params = new URLSearchParams({
        where: `AssessmentNo='${escapeSqlLiteral(safe)}'`,
        outFields: [...REQUIRED_FIELDS, 'Shape.STArea()'].join(','),
        returnGeometry: 'false',
        f: 'json',
      });

      const payload = await requestJson(`${OC_LEGAL_LOTS_QUERY_URL}?${params}`);
      const feature = payload.features?.[0];
      if (!feature) return null;

      return toOrangeCountyParcelValuation(feature.attributes);
    },

    async findByAddress(streetLine: string, zip?: string): Promise<OrangeCountyLookupResult> {
      const normalized = normalizeSiteAddress(streetLine);
      if (normalized === '') {
        throw new OrangeCountyLookupError('Street line is empty');
      }

      const clauses = [`SiteAddress LIKE '${escapeSqlLiteral(normalized)}%'`];
      if (zip !== undefined && zip.trim() !== '') {
        clauses.push(`SiteZip5='${escapeSqlLiteral(zip.trim())}'`);
      }

      const params = new URLSearchParams({
        where: clauses.join(' AND '),
        outFields: [...REQUIRED_FIELDS, 'Shape.STArea()'].join(','),
        returnGeometry: 'false',
        resultRecordCount: String(maxCandidates + 1),
        f: 'json',
      });

      const payload = await requestJson(`${OC_LEGAL_LOTS_QUERY_URL}?${params}`);
      const features = payload.features ?? [];

      if (features.length === 0) return { status: 'not-found' };

      if (features.length > 1) {
        return {
          status: 'ambiguous',
          candidates: features.slice(0, maxCandidates).map((f) => ({
            assessmentNo: String(f.attributes['AssessmentNo'] ?? ''),
            siteAddress: String(f.attributes['SiteAddress'] ?? ''),
            zip: blankToNull(f.attributes['SiteZip5']),
          })),
        };
      }

      return {
        status: 'found',
        valuation: toOrangeCountyParcelValuation(features[0]!.attributes),
      };
    },
  };

  /** Shared transport: HTTP errors, Esri's 200-with-error bodies, timeouts. */
  async function requestJson(url: string): Promise<EsriQueryResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new OrangeCountyLookupError(
          `Orange County assessor service returned HTTP ${response.status}`,
        );
      }
      const payload = (await response.json()) as EsriQueryResponse;
      if (payload.error) {
        throw new OrangeCountyLookupError(
          `Orange County assessor service error: ${payload.error.message ?? 'unknown'}`,
        );
      }
      return payload;
    } catch (err) {
      if (err instanceof OrangeCountyLookupError) throw err;
      throw new OrangeCountyLookupError('Orange County assessor lookup failed', err);
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Default provider used when no lookup is wired up. Always returns null, so
 * estimates degrade to the national benchmark with an honest coverage label
 * rather than failing.
 */
export const noOpOrangeCountyProvider: OrangeCountyAssessorProvider = {
  name: 'none',
  async fetchByAssessmentNo() {
    return null;
  },
  async findByAddress() {
    return { status: 'not-found' };
  },
};
