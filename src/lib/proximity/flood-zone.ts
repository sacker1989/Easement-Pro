/**
 * FEMA flood zone for a point, from the National Flood Hazard Layer.
 *
 * WHY THIS AND NOT THE INFRASTRUCTURE SCAN THAT WAS SPECCED. The proximity
 * scan wants to say "there is a pipeline across your land". The national
 * dataset that could support it, USGS NHD, returns bare numeric `ftype` and
 * `fcode` values with no coded domain, no description field and no lookup
 * table anywhere in the service — checked, 2026-10-05, including the service
 * root and every layer. Classifying those means asserting the NHD code
 * standard from memory, which is the one thing this codebase does not do with
 * facts it serves to users. So that adapter is not built yet and the finding
 * is recorded in the open-data assessment instead.
 *
 * NFHL IS THE OPPOSITE, WHICH IS WHY IT IS HERE. It returns `ZONE_SUBTY` as
 * prose — "AREA OF MINIMAL FLOOD HAZARD", "AREA WITH REDUCED FLOOD RISK DUE
 * TO LEVEE" — and `SFHA_TF` as an authoritative flag. The service says what
 * its own values mean, so nothing has to be inferred.
 *
 * WHY A HOMEOWNER CARES, in the terms this product uses. Flood zone is not an
 * easement and is never presented as one. It is a value-and-protection fact of
 * the same kind: it moves insurance cost by real money, constrains what can be
 * built, and sits directly behind the drainage questions already in the
 * report. It is also national, so it answers something for every address
 * rather than only the three counties with live parcel data.
 *
 * WHAT IT IS NOT. An NFHL zone is the REGULATORY map, not a measurement of
 * this parcel. Maps are revised, some predate nearby development, and a point
 * query cannot see that half a lot sits in a different zone. The copy says so
 * rather than implying a survey.
 */

import { createResilientFetch } from '@/lib/net/resilient-fetch';

/** Flood Hazard Zones, the polygon layer carrying FLD_ZONE. */
export const NFHL_FLOOD_ZONE_LAYER =
  'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28';

/**
 * FEMA's "no value" sentinel for base flood elevation.
 *
 * Rendering -9999 ft to a homeowner is the kind of defect that survives
 * review because it looks like data. Mapped to null at the boundary.
 */
export const BFE_NO_VALUE = -9999;

export interface FloodZoneFound {
  readonly kind: 'found';
  /** FLD_ZONE verbatim, e.g. "AE", "X", "VE". */
  readonly zone: string;
  /** ZONE_SUBTY verbatim — the service's own description. Null when absent. */
  readonly description: string | null;
  /**
   * FEMA's own Special Flood Hazard Area flag, not a reading of the zone
   * letter. SFHA is what drives the federal mandatory-purchase requirement
   * for a federally backed mortgage, so it is the field that carries money.
   */
  readonly inSpecialFloodHazardArea: boolean;
  /** Base flood elevation in feet, or null where FEMA publishes none. */
  readonly baseFloodElevationFt: number | null;
  readonly source: string;
  readonly queriedOn: string;
}

export type FloodZoneResult =
  | FloodZoneFound
  | {
      /** NFHL has no polygon here. NOT the same as "no flood risk". */
      readonly kind: 'no-map-coverage';
      readonly source: string;
      readonly queriedOn: string;
    }
  | {
      readonly kind: 'lookup-failed';
      readonly reason: string;
      readonly source: string;
      readonly queriedOn: string;
    };

export interface FloodZoneQuery {
  readonly lat: number;
  readonly lon: number;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  // Lazy for the same reason county-dispatch is: createResilientFetch throws
  // in a browser, and module init would run there during a client bundle.
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

function buildUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${NFHL_FLOOD_ZONE_LAYER}/query?${params.toString()}`;
}

/**
 * Looks up the flood zone containing a point.
 *
 * NEVER THROWS FOR AN UPSTREAM PROBLEM. A FEMA outage must not take down a
 * report whose other six sections are fine — the flood panel is additive, and
 * the honest degraded state is "we could not check", which the result type
 * carries. Programmer errors (a non-finite coordinate) still throw.
 */
export async function lookupFloodZone(query: FloodZoneQuery): Promise<FloodZoneResult> {
  const { lat, lon } = query;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new TypeError(`lookupFloodZone needs finite coordinates; got ${lat}, ${lon}`);
  }

  const now = query.now ?? (() => new Date());
  const queriedOn = now().toISOString().slice(0, 10);
  const doFetch = query.fetchImpl ?? defaultFetch();
  const source = NFHL_FLOOD_ZONE_LAYER;

  try {
    const response = await doFetch(buildUrl(lat, lon));
    if (!response.ok) {
      return { kind: 'lookup-failed', reason: `HTTP ${response.status}`, source, queriedOn };
    }

    const payload = (await response.json()) as {
      error?: { message?: string };
      features?: Array<{ attributes?: Record<string, unknown> }>;
    };

    // Esri answers HTTP 200 with an error body. Every other provider in this
    // codebase checks for it, and so does this one.
    if (payload.error) {
      return {
        kind: 'lookup-failed',
        reason: payload.error.message ?? 'Esri error response',
        source,
        queriedOn,
      };
    }

    const attributes = payload.features?.[0]?.attributes;
    if (attributes === undefined) {
      return { kind: 'no-map-coverage', source, queriedOn };
    }

    const zone = typeof attributes.FLD_ZONE === 'string' ? attributes.FLD_ZONE.trim() : '';
    if (zone === '') {
      return { kind: 'no-map-coverage', source, queriedOn };
    }

    const subtype =
      typeof attributes.ZONE_SUBTY === 'string' && attributes.ZONE_SUBTY.trim() !== ''
        ? attributes.ZONE_SUBTY.trim()
        : null;

    const bfeRaw = attributes.STATIC_BFE;
    const bfe =
      typeof bfeRaw === 'number' && Number.isFinite(bfeRaw) && bfeRaw !== BFE_NO_VALUE
        ? bfeRaw
        : null;

    return {
      kind: 'found',
      zone,
      description: subtype,
      // FEMA's flag, read directly. Deriving this from the zone letter would
      // mean encoding the SFHA list from memory, and the service already
      // answers it.
      inSpecialFloodHazardArea: attributes.SFHA_TF === 'T',
      baseFloodElevationFt: bfe,
      source,
      queriedOn,
    };
  } catch (err) {
    return {
      kind: 'lookup-failed',
      reason: err instanceof Error ? err.message : 'Unknown error',
      source,
      queriedOn,
    };
  }
}

/**
 * What this means for the homeowner, in their terms.
 *
 * SPLIT ON THE SFHA FLAG RATHER THAN THE ZONE LETTER, because that is the
 * distinction that carries money: SFHA is what triggers the federal
 * mandatory-purchase requirement on a federally backed mortgage.
 *
 * THE LEVEE CASE IS CALLED OUT SEPARATELY and is the reason this is not a
 * two-way branch. "Zone X, reduced risk due to levee" is outside the SFHA and
 * is not the same as "Zone X, minimal hazard" — the protection is a structure
 * that can be overtopped or decertified, and treating the two as one would
 * tell a levee-protected owner they have nothing to think about.
 */
export function floodImplication(result: FloodZoneFound): string {
  if (result.inSpecialFloodHazardArea) {
    return (
      `FEMA maps this location inside a Special Flood Hazard Area (zone ${result.zone}). That has ` +
      'two practical consequences: a federally backed mortgage generally requires flood insurance ' +
      'here, and local rules usually restrict how low you may build. Both are costs a buyer will ' +
      'price in, so it is worth knowing before you are asked about it.'
    );
  }

  if (/levee/i.test(result.description ?? '')) {
    return (
      `FEMA maps this location outside the Special Flood Hazard Area, but as an area whose reduced ` +
      'risk depends on a levee. That is not the same as low risk: the protection is a structure, ' +
      'levees are overtopped and are sometimes decertified, and a decertification moves every ' +
      'property behind it into the hazard area at once. Worth insuring against even where it is ' +
      'not required.'
    );
  }

  return (
    `FEMA maps this location outside the Special Flood Hazard Area (zone ${result.zone}). Flood ` +
    'insurance is generally not required by a lender here. It is not a statement that flooding is ' +
    'impossible — a large share of flood claims come from outside mapped hazard areas, often from ' +
    'drainage that backs up rather than a river rising.'
  );
}

/** Stated wherever a zone is shown. */
export const FLOOD_ZONE_DISCLOSURE =
  'This is FEMA’s regulatory flood map, not a survey of your parcel. The maps are revised, some ' +
  'predate nearby development, and this was looked up as a single point — a large lot can sit in ' +
  'more than one zone. Where no map covers an address, that means FEMA has not mapped it, which ' +
  'is not a finding that the risk is low. Check the FEMA Flood Map Service Center for the official ' +
  'determination before relying on any of it.';
