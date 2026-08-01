/**
 * Live San Diego County assessor valuation lookup, with Proposition 13
 * vintage recovery from DOCDATE.
 *
 * WHY THIS IS THE SECOND-BEST COUNTY AFTER LA: San Diego publishes assessed
 * land and improvement values AND a usable reassessment vintage. LA publishes
 * an explicit Roll_LandBaseYear; Orange County publishes nothing and is
 * therefore blocked. San Diego sits between them — DOCDATE is the recording
 * date of the parcel's document, and under Prop 13 a change of ownership
 * triggers reassessment, so it behaves like a base year.
 *
 * That is validated, not assumed. Complete enumeration of 97,026 parcels
 * across 8 ZIPs shows assessed value per living square foot rising 2.18x with
 * DOCDATE recency and land share rising monotonically across all seven
 * vintage buckets, while median effective year built stays flat within each
 * ZIP — so the gradient is not newer housing. A Prop 13 model with no fitted
 * parameters agrees with the FHFA index within +/-8% on six of eight buckets.
 * Full method and caveats: docs/validation-sd-docdate.md.
 *
 * WHAT DOCDATE ACTUALLY IS. The county's data dictionary (SanGIS PARCELS
 * metadata, from the Assessor's Master Property Record) calls it the
 * "Document recording date of document that CREATED THIS PARCEL". Read
 * literally that would mean the subdivision map, not a conveyance — so it was
 * tested directly, and it does not mean that.
 *
 * Grouping parcels by SUBNAME: if DOCDATE were the creating map, every parcel
 * in one subdivision would share a single date and document number. Measured
 * instead, EAST S D VILLA HEIGHTS has 901 distinct DOCDATEs and 1,000 distinct
 * DOCNMBRs across 1,000 parcels, spanning 1976-2026, with the most common date
 * held by 0.4% of them. Five other large subdivisions behave identically.
 * Essentially every parcel carries its own document.
 *
 * So "created this parcel" means created this parcel RECORD in the MPR — the
 * assessor opens a new record on transfer, which is ordinary practice. DOCDATE
 * therefore does track conveyances, and the county-wide distribution supports
 * that too: parcel counts rise steeply toward recent years, the shape of a
 * holding-period distribution rather than of development eras.
 *
 * An earlier revision of this comment claimed the opposite and used it to
 * explain two measured anomalies in docs/reconciliation-two-paths.md §2b.
 * That explanation is withdrawn; those anomalies are open again.
 *
 * DOCDATE IS A PROXY, NOT A PUBLISHED BASE YEAR, and this module is built so
 * callers cannot forget that. Every valuation carries a `vintage` whose
 * reliability must be branched on before any indexed figure is shown, and the
 * measured per-parcel dispersion is wide even where it passes. See
 * VintageReliability.
 */

import {
  isReliableHpiYear,
  SAN_DIEGO_HPI_BY_YEAR,
  SAN_DIEGO_HPI_LATEST_YEAR,
} from './san-diego-hpi-data';

const SD_PARCEL_QUERY_URL =
  'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0/query';

const REQUIRED_FIELDS = [
  'APN',
  'ASR_LAND',
  'ASR_IMPR',
  'ASR_TOTAL',
  'SITUS_ADDRESS',
  'SITUS_PRE_DIR',
  'SITUS_STREET',
  'SITUS_SUFFIX',
  'SITUS_POST_DIR',
  'SITUS_ZIP',
  'DOCDATE',
  'DOCTYPE',
  'TOTAL_LVG_AREA',
] as const;

/**
 * DOCTYPE code meanings, CONFIRMED against the county's published data
 * dictionary (SanGIS PARCELS metadata, derived from the Assessor's Master
 * Property Record; https://sdplantatlas.org/pdffiles/sangis_parcels.pdf).
 *
 * This closes the fourth condition of use in docs/validation-sd-docdate.md,
 * which previously recorded these meanings as inferred from behaviour. The
 * inference was correct: '1' is a grant deed and '2' is a quitclaim.
 */
export const DOCTYPE_MEANINGS: Readonly<Record<string, string>> = {
  '0': 'Unresearched',
  '1': 'Grant deed',
  '2': 'Quit claim',
  '3': 'Unrecorded deed',
  '4': 'Recorded death certificate',
  '5': 'Unrecorded death certificate',
  '6': 'Other types recorded document (Trustees deed)',
  '7': 'Unknown',
  '8': 'Recorded contract',
};

/**
 * Grant deed — California's standard full-value transfer instrument, and the
 * only code treated as a reassessment trigger here.
 *
 * The behavioural evidence and the documentation agree. Grant-deed parcels
 * carry assessed values 1.5-1.75x above quitclaim parcels at every decade
 * measured, and a quitclaim is the ordinary instrument for exactly the
 * transfers Proposition 13 EXCLUDES from reassessment — between spouses, from
 * parent to child, and into or out of a trust — which preserve the prior
 * basis. Trustee's deeds ('6') are foreclosure conveyances and are likewise
 * not ordinary market transfers.
 */
export const FULL_TRANSFER_DOCTYPE = '1';

/**
 * Vintages in this window are distrusted. 2004-2007 purchases sat at the
 * bubble peak and were widely reduced under Proposition 8 decline-in-value
 * reassessment after 2008, then restored only gradually — so their assessed
 * value does not reflect their DOCDATE market. The validation measured a model
 * ratio of 0.61 here against 0.92-1.06 elsewhere. The Prop 8 mechanism is a
 * plausible but UNTESTED explanation; the distrust is based on the measured
 * deviation, which stands regardless of the cause.
 */
export const PROP8_SUSPECT_YEARS = { from: 2004, to: 2007 } as const;

export type VintageReliability =
  /** Full-value transfer, outside the Prop 8 window, index-backed year. */
  | 'usable'
  /** 2004-2007. Measured deviation; do not index. */
  | 'prop8-suspect'
  /** Not a full-value transfer, so the vintage may not be a reassessment. */
  | 'excluded-transfer'
  /** Year has too few FHFA tracts to index against (pre-1986). */
  | 'thin-index'
  /** DOCDATE absent or not MMDDYY. */
  | 'unparseable';

export interface ReassessmentVintage {
  /** Four-digit year parsed from DOCDATE, or null when unparseable. */
  readonly year: number | null;
  readonly docType: string | null;
  readonly reliability: VintageReliability;
  /** Why this reliability was assigned. Surface it; do not swallow it. */
  readonly explanation: string;
}

export interface SanDiegoParcelValuation {
  readonly apn: string;
  readonly situsFullAddress: string;
  readonly zip: string | null;
  /**
   * Parcel area from Shape.STArea(). Spatial reference is EPSG:2230 (NAD83
   * California zone 6, US survey feet), so this is already square feet.
   *
   * Shape.STArea() is used rather than the ACREAGE column because ACREAGE is
   * frequently null — two of four parcels in an arbitrary sample. The county's
   * data dictionary gives the reason: ACREAGE is populated only "if over 0.25
   * acres (blank if smaller)", so it is systematically absent for exactly the
   * ordinary residential lots this product cares about most.
   */
  readonly lotAreaSqFt: number;
  readonly landValue: number;
  readonly improvementValue: number;
  readonly totalValue: number;
  /** Living area in sq ft, or null. Used to normalise across house sizes. */
  readonly livingAreaSqFt: number | null;
  readonly landValuePerSqFt: number;
  /** Prop 13 vintage recovered from DOCDATE. Branch on `reliability`. */
  readonly vintage: ReassessmentVintage;
}

export interface SanDiegoParcelCandidate {
  readonly apn: string;
  readonly situsFullAddress: string;
  readonly zip: string | null;
}

export type SanDiegoLookupResult =
  | { status: 'found'; valuation: SanDiegoParcelValuation }
  | { status: 'not-found' }
  | { status: 'ambiguous'; candidates: SanDiegoParcelCandidate[] };

export interface SanDiegoAssessorProvider {
  name: string;
  fetchByApn(apn: string): Promise<SanDiegoParcelValuation | null>;
  findByAddress(streetLine: string, zip?: string): Promise<SanDiegoLookupResult>;
}

export class SanDiegoLookupError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'SanDiegoLookupError';
  }
}

interface EsriQueryResponse {
  error?: { code?: number; message?: string };
  features?: Array<{ attributes: Record<string, unknown> }>;
}

/**
 * Parses DOCDATE, stored as MMDDYY.
 *
 * The two-digit year is pivoted at 26, the current year: "24" is 2024 and "96"
 * is 1996. A genuine 1924 deed would therefore be misread as 2024. That
 * ambiguity is unavoidable from a two-digit field and is why very old vintages
 * cannot be fully trusted; it is one more reason the pre-1986 range is gated
 * as `thin-index` anyway.
 */
export function parseDocDate(raw: unknown, pivot = 26): number | null {
  const s = String(raw ?? '').trim();
  if (!/^\d{6}$/.test(s)) return null;
  const mm = Number(s.slice(0, 2));
  const dd = Number(s.slice(2, 4));
  // Reject impossible dates rather than deriving a year from a corrupt field.
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const yy = Number(s.slice(4));
  return yy <= pivot ? 2000 + yy : 1900 + yy;
}

/** Applies the four measured conditions of use to a raw DOCDATE/DOCTYPE pair. */
export function classifyVintage(rawDocDate: unknown, rawDocType: unknown): ReassessmentVintage {
  const docType = String(rawDocType ?? '').trim() || null;
  const year = parseDocDate(rawDocDate);

  if (year === null) {
    return {
      year: null,
      docType,
      reliability: 'unparseable',
      explanation:
        'The county publishes no usable document date for this parcel, so there is no way to tell ' +
        'what market its assessment reflects. The assessed value is reported as recorded and is ' +
        'not adjusted.',
    };
  }

  if (docType !== FULL_TRANSFER_DOCTYPE) {
    const named = docType !== null ? DOCTYPE_MEANINGS[docType] : undefined;
    return {
      year,
      docType,
      reliability: 'excluded-transfer',
      explanation:
        `The document that created this parcel record (${year}) is ` +
        `${named ? `a ${named.toLowerCase()}` : 'not a grant deed'}, not a grant deed. ` +
        'Parcels of this document type carry assessed values well below those conveyed by grant ' +
        'deed, consistent with instruments that do not trigger reassessment under Proposition 13 ' +
        '— quitclaims between spouses, parent-child transfers, transfers into or out of a trust, ' +
        'and foreclosure conveyances. The document date therefore may not be a reassessment ' +
        'date, and the assessed value is not adjusted.',
    };
  }

  if (year >= PROP8_SUSPECT_YEARS.from && year <= PROP8_SUSPECT_YEARS.to) {
    return {
      year,
      docType,
      reliability: 'prop8-suspect',
      explanation:
        `This parcel was last conveyed in ${year}, at the peak of the housing bubble. ` +
        'Assessments from that window were widely reduced under Proposition 8 decline-in-value ' +
        'reassessment after 2008 and restored only gradually, so the assessed value does not ' +
        'reliably reflect the market at the conveyance date. It is not adjusted.',
    };
  }

  if (!isReliableHpiYear(year)) {
    return {
      year,
      docType,
      reliability: 'thin-index',
      explanation:
        `This parcel was last conveyed in ${year}, which predates reliable house-price index ` +
        'coverage for San Diego County — the index for those years rests on too few census ' +
        'tracts to serve as a county figure. The assessed value is not adjusted.',
    };
  }

  return {
    year,
    docType,
    reliability: 'usable',
    explanation:
      `This parcel was last conveyed in ${year} by a full-value transfer, which under ` +
      'Proposition 13 triggers reassessment to market. The assessed value is treated as ' +
      `reflecting the ${year} market and indexed forward.`,
  };
}

export interface SanDiegoMarketAdjustment {
  readonly vintageYear: number;
  readonly indexedToYear: number;
  readonly indexRatio: number;
  readonly indexedLandValue: number;
  readonly marketLandValuePerSqFt: number;
  readonly note: string;
}

/**
 * Indexes a San Diego parcel's land value forward from its DOCDATE vintage.
 *
 * Returns null for any vintage that is not `usable`. That is deliberate: there
 * is no "adjust anyway with a caveat" path, because a figure with an
 * unreliable vintage behind it is not a weaker estimate but a different
 * quantity — the same reasoning as `valuationConfidenceToTieredResult`.
 */
export function marketAdjustSanDiegoParcel(
  valuation: SanDiegoParcelValuation,
  hpiByYear: Readonly<Record<number, number>> = SAN_DIEGO_HPI_BY_YEAR,
  targetYear: number = SAN_DIEGO_HPI_LATEST_YEAR,
): SanDiegoMarketAdjustment | null {
  const { vintage } = valuation;
  if (vintage.reliability !== 'usable' || vintage.year === null) return null;

  const from = hpiByYear[vintage.year];
  const to = hpiByYear[targetYear];
  if (from === undefined || to === undefined || from <= 0) return null;

  const indexRatio = to / from;
  const indexedLandValue = valuation.landValue * indexRatio;

  return {
    vintageYear: vintage.year,
    indexedToYear: targetYear,
    indexRatio,
    indexedLandValue,
    marketLandValuePerSqFt: indexedLandValue / valuation.lotAreaSqFt,
    note:
      `Assessed land value reflects a ${vintage.year} conveyance, ${targetYear - vintage.year} ` +
      `years before the ${targetYear} index. Under Proposition 13 the assessment does not track ` +
      `the market, so it has been indexed forward by the San Diego County house-price index ` +
      `(${indexRatio.toFixed(2)}x). The vintage is inferred from the county's recorded document ` +
      `date, not from a published assessment base year. This is a modelled adjustment assuming ` +
      `county-median appreciation, not an appraisal or an observed sale price.`,
  };
}

function blankToNull(v: unknown): string | null {
  const t = String(v ?? '').trim();
  return t === '' ? null : t;
}

function composeSitus(a: Record<string, unknown>): string {
  return [
    a['SITUS_ADDRESS'],
    blankToNull(a['SITUS_PRE_DIR']),
    blankToNull(a['SITUS_STREET']),
    blankToNull(a['SITUS_SUFFIX']),
    blankToNull(a['SITUS_POST_DIR']),
  ]
    .filter((p) => p !== null && p !== undefined && String(p).trim() !== '' && String(p) !== '0')
    .join(' ')
    .trim();
}

export function toSanDiegoParcelValuation(
  attrs: Record<string, unknown>,
): SanDiegoParcelValuation {
  const lotAreaSqFt = Number(attrs['Shape.STArea()']);
  if (!Number.isFinite(lotAreaSqFt) || lotAreaSqFt <= 0) {
    throw new SanDiegoLookupError('Assessor record reports a non-positive parcel area');
  }

  const landValue = Number(attrs['ASR_LAND']);
  if (!Number.isFinite(landValue)) {
    throw new SanDiegoLookupError('Assessor record publishes no land value');
  }
  if (landValue <= 0) {
    // Exempt and public parcels legitimately carry a zero land value and
    // cannot support a per-sq-ft derivation.
    throw new SanDiegoLookupError(
      'Assessor record reports a non-positive land value, so no per-sq-ft value can be derived',
    );
  }

  const apn = blankToNull(attrs['APN']);
  if (apn === null) {
    throw new SanDiegoLookupError('Assessor record is missing required field "APN"');
  }

  const improvementValue = Number(attrs['ASR_IMPR']) || 0;
  const living = Number(attrs['TOTAL_LVG_AREA']);

  return {
    apn,
    situsFullAddress: composeSitus(attrs),
    zip: blankToNull(attrs['SITUS_ZIP']),
    lotAreaSqFt,
    landValue,
    improvementValue,
    totalValue: Number(attrs['ASR_TOTAL']) || landValue + improvementValue,
    livingAreaSqFt: Number.isFinite(living) && living > 0 ? living : null,
    landValuePerSqFt: landValue / lotAreaSqFt,
    vintage: classifyVintage(attrs['DOCDATE'], attrs['DOCTYPE']),
  };
}

export function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''").replace(/[%_]/g, (c) => `[${c}]`);
}

/** APNs are 10-digit strings on this layer. */
function assertSafeApn(apn: string): string {
  const bare = apn.replace(/[-\s]/g, '');
  if (!/^\d{8,12}$/.test(bare)) {
    throw new SanDiegoLookupError(`"${apn}" is not a well-formed San Diego APN`);
  }
  return bare;
}

/**
 * Street suffixes stripped when matching, because the county stores the
 * suffix in its own column (SITUS_SUFFIX) while users type it inline —
 * "5102 Enelra Pl" must match SITUS_STREET 'ENELRA'.
 */
const SUFFIXES = new Set([
  'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE', 'PL', 'PLACE',
  'CT', 'COURT', 'LN', 'LANE', 'BLVD', 'BOULEVARD', 'WAY', 'CIR', 'CIRCLE',
  'TER', 'TERRACE', 'PKWY', 'PARKWAY', 'TRL', 'TRAIL',
]);

export interface ParsedSitus {
  readonly houseNumber: number;
  readonly street: string;
}

/**
 * Splits "5102 Enelra Pl" into house number and street name. The street name
 * may contain spaces — the county stores values such as "PAUL JONES".
 */
export function parseSanDiegoAddress(streetLine: string): ParsedSitus {
  const cleaned = streetLine.trim().toUpperCase().replace(/\s+/g, ' ').replace(/[.,]/g, '');
  const m = /^(\d+)\s+(.+)$/.exec(cleaned);
  if (!m) {
    throw new SanDiegoLookupError(
      `"${streetLine}" does not begin with a house number, which this county's layout requires`,
    );
  }
  const parts = m[2]!.split(' ');
  while (parts.length > 1 && SUFFIXES.has(parts[parts.length - 1]!)) parts.pop();
  return { houseNumber: Number(m[1]), street: parts.join(' ') };
}

export interface SanDiegoProviderOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  maxCandidates?: number;
}

export function createSanDiegoAssessorProvider(
  options: SanDiegoProviderOptions = {},
): SanDiegoAssessorProvider {
  const { timeoutMs = 10_000, fetchImpl = fetch, maxCandidates = 25 } = options;
  const outFields = [...REQUIRED_FIELDS, 'Shape.STArea()'].join(',');

  return {
    name: 'san-diego-lafco-parcels',

    async fetchByApn(apn: string): Promise<SanDiegoParcelValuation | null> {
      const safe = assertSafeApn(apn);
      const params = new URLSearchParams({
        where: `APN='${escapeSqlLiteral(safe)}'`,
        outFields,
        returnGeometry: 'false',
        f: 'json',
      });
      const payload = await requestJson(`${SD_PARCEL_QUERY_URL}?${params}`);
      const feature = payload.features?.[0];
      return feature ? toSanDiegoParcelValuation(feature.attributes) : null;
    },

    async findByAddress(streetLine: string, zip?: string): Promise<SanDiegoLookupResult> {
      const { houseNumber, street } = parseSanDiegoAddress(streetLine);

      const clauses = [
        `SITUS_ADDRESS=${houseNumber}`,
        `SITUS_STREET LIKE '${escapeSqlLiteral(street)}%'`,
      ];
      if (zip !== undefined && zip.trim() !== '') {
        clauses.push(`SITUS_ZIP LIKE '${escapeSqlLiteral(zip.trim())}%'`);
      }

      const params = new URLSearchParams({
        where: clauses.join(' AND '),
        outFields,
        returnGeometry: 'false',
        resultRecordCount: String(maxCandidates + 1),
        f: 'json',
      });

      const payload = await requestJson(`${SD_PARCEL_QUERY_URL}?${params}`);
      const features = payload.features ?? [];

      if (features.length === 0) return { status: 'not-found' };
      if (features.length > 1) {
        return {
          status: 'ambiguous',
          candidates: features.slice(0, maxCandidates).map((f) => ({
            apn: String(f.attributes['APN'] ?? ''),
            situsFullAddress: composeSitus(f.attributes),
            zip: blankToNull(f.attributes['SITUS_ZIP']),
          })),
        };
      }
      return { status: 'found', valuation: toSanDiegoParcelValuation(features[0]!.attributes) };
    },
  };

  async function requestJson(url: string): Promise<EsriQueryResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal });
      if (!response.ok) {
        throw new SanDiegoLookupError(
          `San Diego assessor service returned HTTP ${response.status}`,
        );
      }
      const payload = (await response.json()) as EsriQueryResponse;
      if (payload.error) {
        throw new SanDiegoLookupError(
          `San Diego assessor service error: ${payload.error.message ?? 'unknown'}`,
        );
      }
      return payload;
    } catch (err) {
      if (err instanceof SanDiegoLookupError) throw err;
      throw new SanDiegoLookupError('San Diego assessor lookup failed', err);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const noOpSanDiegoProvider: SanDiegoAssessorProvider = {
  name: 'none',
  async fetchByApn() {
    return null;
  },
  async findByAddress() {
    return { status: 'not-found' };
  },
};
