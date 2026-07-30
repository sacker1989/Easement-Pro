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
 * for one.
 */

const OC_LEGAL_LOTS_QUERY_URL =
  'https://www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0/query';

/** Fields required to derive a per-sq-ft land value. */
const REQUIRED_FIELDS = [
  'AssessmentNo',
  'SiteAddress',
  'SiteZip5',
  'LandVal',
  'ImprovedVal',
] as const;

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
  /** Derived: landValue / lotAreaSqFt. Reflects an unknown base year. */
  readonly landValuePerSqFt: number;
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
    landValuePerSqFt: landValue / lotAreaSqFt,
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
 * Normalises a typed street line to the layer's stored form: uppercase, single
 * spaces, no trailing punctuation. Matching is a prefix LIKE so that "1251 N
 * ALAMO" finds "1251 N ALAMO ST" — the county stores a suffix the user may
 * not type. Over-matching surfaces as `ambiguous` rather than a wrong parcel.
 */
export function normalizeSiteAddress(streetLine: string): string {
  return streetLine.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[.,]+$/, '');
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
