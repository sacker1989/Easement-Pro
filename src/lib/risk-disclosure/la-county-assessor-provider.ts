/**
 * Live LA County assessor valuation lookup.
 *
 * Backed by the county's public Esri REST parcel service, verified against the
 * live endpoint on 2026-07-25 (see src/lib/jurisdiction/county-database.ts for
 * the full schema notes). This is the only county in the routing table with a
 * machine-queryable source, which is why the provider is county-specific
 * rather than generic — a national abstraction over one implementation would
 * be speculative.
 */

const LA_COUNTY_PARCEL_QUERY_URL =
  'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0/query';

/** Fields required to derive a per-sq-ft land value. */
const REQUIRED_FIELDS = [
  'AIN',
  'APN',
  'SitusFullAddress',
  'Roll_Year',
  'Roll_LandValue',
  'Roll_ImpValue',
] as const;

export interface AssessorParcelValuation {
  readonly ain: string;
  readonly apn: string;
  readonly situsFullAddress: string;
  /**
   * Parcel area from Shape.STArea(). The service's spatial reference is
   * EPSG:2229 (NAD83 California zone 5, US survey feet), so this is already
   * square feet — no unit conversion is applied or needed.
   */
  readonly lotAreaSqFt: number;
  readonly landValue: number;
  readonly improvementValue: number;
  /** Assessment roll year, e.g. "2026". Surfaced so estimates can cite vintage. */
  readonly rollYear: string;
  /** Derived: landValue / lotAreaSqFt. */
  readonly landValuePerSqFt: number;
}

export interface LaCountyAssessorProvider {
  name: string;
  /** Returns null when the parcel is not found. Throws on transport failure. */
  fetchByAin(ain: string): Promise<AssessorParcelValuation | null>;
}

export class AssessorLookupError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'AssessorLookupError';
  }
}

/** Shape of the subset of the Esri query response this module reads. */
interface EsriQueryResponse {
  error?: { code?: number; message?: string };
  features?: Array<{ attributes: Record<string, unknown> }>;
}

function requireString(attrs: Record<string, unknown>, key: string): string {
  const raw = attrs[key];
  if (raw === null || raw === undefined || raw === '') {
    throw new AssessorLookupError(`Assessor record is missing required field "${key}"`);
  }
  return String(raw);
}

function requireFiniteNumber(attrs: Record<string, unknown>, key: string): number {
  const value = Number(attrs[key]);
  if (!Number.isFinite(value)) {
    throw new AssessorLookupError(`Assessor record field "${key}" is not a finite number`);
  }
  return value;
}

/** Maps a raw Esri attribute bag onto the valuation shape, validating as it goes. */
export function toAssessorParcelValuation(attrs: Record<string, unknown>): AssessorParcelValuation {
  const lotAreaSqFt = requireFiniteNumber(attrs, 'Shape.STArea()');
  if (lotAreaSqFt <= 0) {
    throw new AssessorLookupError('Assessor record reports a non-positive parcel area');
  }

  const landValue = requireFiniteNumber(attrs, 'Roll_LandValue');
  if (landValue <= 0) {
    // Exempt and public parcels legitimately carry a zero land value. They
    // cannot support a per-sq-ft derivation, so treat them as unusable rather
    // than emitting a $0/sq ft estimate.
    throw new AssessorLookupError(
      'Assessor record reports a non-positive land value, so no per-sq-ft value can be derived',
    );
  }

  return {
    ain: requireString(attrs, 'AIN'),
    apn: requireString(attrs, 'APN'),
    situsFullAddress: requireString(attrs, 'SitusFullAddress'),
    lotAreaSqFt,
    landValue,
    improvementValue: Number(attrs['Roll_ImpValue']) || 0,
    rollYear: requireString(attrs, 'Roll_Year'),
    landValuePerSqFt: landValue / lotAreaSqFt,
  };
}

/**
 * Escapes a value for inclusion in an Esri `where` clause. AINs are digit
 * strings, so this rejects anything else outright rather than attempting to
 * sanitize — the where clause is assembled as SQL by the remote service.
 */
function assertSafeAin(ain: string): string {
  if (!/^\d{7,12}$/.test(ain)) {
    throw new AssessorLookupError(`"${ain}" is not a well-formed LA County AIN (7-12 digits)`);
  }
  return ain;
}

export interface LiveProviderOptions {
  timeoutMs?: number;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export function createLaCountyAssessorProvider(
  options: LiveProviderOptions = {},
): LaCountyAssessorProvider {
  const { timeoutMs = 10_000, fetchImpl = fetch } = options;

  return {
    name: 'la-county-esri-parcel',

    async fetchByAin(ain: string): Promise<AssessorParcelValuation | null> {
      const safeAin = assertSafeAin(ain);

      const params = new URLSearchParams({
        where: `AIN='${safeAin}'`,
        outFields: [...REQUIRED_FIELDS, 'Shape.STArea()'].join(','),
        returnGeometry: 'false',
        f: 'json',
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let payload: EsriQueryResponse;
      try {
        const response = await fetchImpl(`${LA_COUNTY_PARCEL_QUERY_URL}?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new AssessorLookupError(
            `LA County assessor service returned HTTP ${response.status}`,
          );
        }
        payload = (await response.json()) as EsriQueryResponse;
      } catch (err) {
        if (err instanceof AssessorLookupError) throw err;
        throw new AssessorLookupError('LA County assessor lookup failed', err);
      } finally {
        clearTimeout(timer);
      }

      // Esri reports query errors in a 200 body rather than an HTTP status.
      if (payload.error) {
        throw new AssessorLookupError(
          `LA County assessor service error: ${payload.error.message ?? 'unknown'}`,
        );
      }

      const feature = payload.features?.[0];
      if (!feature) {
        return null;
      }

      return toAssessorParcelValuation(feature.attributes);
    },
  };
}

/**
 * Default provider used when no lookup is wired up. Always returns null, so
 * estimates degrade to the national benchmark with an honest coverage label
 * rather than failing.
 */
export const noOpAssessorProvider: LaCountyAssessorProvider = {
  name: 'none',
  async fetchByAin() {
    return null;
  },
};
