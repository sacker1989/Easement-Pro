import { createResilientFetch } from '@/lib/net/resilient-fetch';
import type { LngLat } from '@/lib/geo/planar-distance';
import type { InfrastructureFeature } from './infrastructure';

/**
 * Utility infrastructure published by a county itself.
 *
 * WHY THIS EXISTS ALONGSIDE OPENSTREETMAP. OSM maps long-distance
 * transmission well and ordinary residential distribution poorly — measured
 * repeatedly, and the reason the scan's commonest answer is "nothing mapped".
 * Where a county publishes its own utility network the difference is not
 * marginal: near four parcels in unincorporated Lakeside, OSM returned zero
 * features and San Diego County's sewer layer returned twenty-two to
 * twenty-nine, each with a diameter, a material and a facility id.
 *
 * AUTHORITATIVE, AND STILL NOT A DEED. A county sewer layer is the county's
 * own record of its own pipes, which is a far stronger thing than a volunteer
 * map — and it is still not a record of who may cross your land. A main
 * running through a parcel is evidence worth chasing, not a finding that an
 * easement exists; `evidence-tier.ts` says this at more length and says it to
 * the reader.
 *
 * COVERAGE IS PER-LAYER AND MUST BE STATED. San Diego County DPW serves
 * county service areas; the incorporated cities run their own systems and are
 * absent from this layer entirely. A query over El Cajon returns nothing, and
 * a reader who takes that for "no sewer near me" has been misled by a
 * jurisdictional boundary. Every source therefore carries a `coverage`
 * sentence that is rendered whenever that source finds nothing.
 */

export interface CountyUtilitySource {
  /** Esri layer URL, without the /query suffix. */
  readonly layerUrl: string;
  /** Fields worth reading; kept narrow so the payload stays small. */
  readonly outFields: readonly string[];
  /** Turns one feature's attributes into a phrase a homeowner recognises. */
  readonly describe: (attributes: Readonly<Record<string, unknown>>) => string;
  /** Who publishes it, for attribution on the page. */
  readonly publisher: string;
  /**
   * What this layer does and does not cover, in the publisher's terms.
   *
   * SHOWN WHEN THE SOURCE FINDS NOTHING, which is when it matters. Absence
   * inside a coverage area and absence outside one look identical in a query
   * result and mean opposite things.
   */
  readonly coverage: string;
}

/** Sources by county, as `county-dispatch.ts` names them. */
export const COUNTY_UTILITY_SOURCES: Readonly<Record<string, readonly CountyUtilitySource[]>> = {
  'San Diego County': [
    {
      layerUrl:
        'https://gis-public.sandiegocounty.gov/arcgis/rest/services/DPW/WASTEWATER/MapServer/6',
      outFields: ['FACILITY_ID', 'MATERIAL', 'DIAMETER', 'STATUS'],
      describe: (a) => {
        const diameter = typeof a['DIAMETER'] === 'number' && a['DIAMETER'] > 0 ? `${a['DIAMETER']}-inch ` : '';
        /*
         * Material codes are the county's, expanded only where the expansion
         * is unambiguous. An unknown code is printed as it stands rather than
         * guessed at — "XXX" appears in the data and means nothing published.
         */
        const material =
          { VCP: 'vitrified clay', DIP: 'ductile iron', PVC: 'PVC', RCP: 'reinforced concrete' }[
            String(a['MATERIAL'] ?? '')
          ] ?? null;
        return `${diameter}${material ? `${material} ` : ''}gravity sewer main`;
      },
      publisher: 'San Diego County Department of Public Works',
      coverage:
        'This layer is San Diego County DPW’s own sewer network, which serves county service ' +
        'areas. Incorporated cities — San Diego, Chula Vista, El Cajon and the rest — run their ' +
        'own systems and do not appear in it at all. Finding nothing here means the county does ' +
        'not maintain sewer at this address, which is not the same as there being none.',
    },
  ],
  'Orange County': [
    {
      layerUrl: 'https://www.ocgis.com/arcpub/rest/services/Flood/Stormwater_Network/MapServer/7',
      outFields: ['Material', 'CrossSectionShape', 'SourceSize', 'LifecycleStatus', 'OwnedBy'],
      describe: (a) => {
        const size = typeof a['SourceSize'] === 'string' && a['SourceSize'].trim() !== '' ? `${a['SourceSize']} ` : '';
        const shape =
          { Circular: 'circular', Rectangular: 'box', Arch: 'arch' }[String(a['CrossSectionShape'] ?? '')] ?? '';
        const material =
          { RC: 'reinforced concrete', RCP: 'reinforced concrete', CMP: 'corrugated metal', PVC: 'PVC' }[
            String(a['Material'] ?? '')
          ] ?? '';
        /*
         * OWNERSHIP IS THE PART A HOMEOWNER CARES ABOUT. Roughly three in four
         * of these are OwnedBy "Private" — a privately owned storm drain
         * crossing a residential lot is the drainage-easement case, and it
         * raises a different question from a city-owned line: who maintains
         * it, and under what document. Said plainly rather than buried in a
         * code.
         */
        const owner =
          String(a['OwnedBy'] ?? '') === 'Private'
            ? ' (privately owned, not the city’s)'
            : typeof a['OwnedBy'] === 'string' && a['OwnedBy'] !== 'Unknown'
              ? ` (${a['OwnedBy']})`
              : '';
        const described = [size, shape, material].filter(Boolean).join(' ').trim();
        return `${described ? `${described} ` : ''}storm drain${owner}`;
      },
      publisher: 'Orange County Public Works stormwater network',
      coverage:
        'This layer is the Orange County stormwater network, which is mapped city by city and is ' +
        'far more complete in some jurisdictions than others. Finding nothing here means no storm ' +
        'drain is recorded in this layer at this address — not that none exists. A city that ' +
        'maintains its own records may simply not have contributed them.',
    },
  ],
};

export type CountyUtilityResult =
  | {
      readonly kind: 'found';
      readonly features: readonly InfrastructureFeature[];
      readonly publishers: readonly string[];
    }
  /** Every source queried cleanly and matched nothing. */
  | { readonly kind: 'none-found'; readonly coverageNotes: readonly string[] }
  /** The county publishes nothing usable for this purpose. */
  | { readonly kind: 'no-source' }
  | { readonly kind: 'lookup-failed'; readonly reason: string };

let sharedFetch: typeof fetch | null = null;
function defaultFetch(): typeof fetch {
  if (sharedFetch === null) sharedFetch = createResilientFetch() as unknown as typeof fetch;
  return sharedFetch;
}

export interface CountyUtilityQuery {
  readonly county: string;
  /** Parcel bounding box, padded by the caller's search radius. */
  readonly envelope: readonly [number, number, number, number];
  readonly fetchImpl?: typeof fetch;
}

/**
 * Queries whatever utility layers the county publishes.
 *
 * NEVER THROWS, and never puts coordinates in a reason: the query URL carries
 * the parcel's envelope, and reasons travel into logs.
 */
export async function lookupCountyUtilities(
  query: CountyUtilityQuery,
): Promise<CountyUtilityResult> {
  const sources = COUNTY_UTILITY_SOURCES[query.county];
  if (sources === undefined || sources.length === 0) return { kind: 'no-source' };

  const doFetch = query.fetchImpl ?? defaultFetch();
  const features: InfrastructureFeature[] = [];
  const publishers = new Set<string>();
  const coverageNotes: string[] = [];
  let anyFailed = false;

  for (const source of sources) {
    const params = new URLSearchParams({
      geometry: query.envelope.join(','),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: source.outFields.join(','),
      returnGeometry: 'true',
      f: 'json',
    });

    try {
      const response = await doFetch(`${source.layerUrl}/query?${params}`);
      if (!response.ok) {
        anyFailed = true;
        continue;
      }
      const payload = (await response.json()) as {
        error?: unknown;
        features?: ReadonlyArray<{
          attributes?: Record<string, unknown>;
          geometry?: { paths?: ReadonlyArray<ReadonlyArray<readonly number[]>> };
        }>;
      };
      // Esri answers errors with HTTP 200 and an {error} body.
      if (payload.error !== undefined) {
        anyFailed = true;
        continue;
      }

      const found = payload.features ?? [];
      if (found.length === 0) {
        coverageNotes.push(source.coverage);
        continue;
      }

      publishers.add(source.publisher);
      for (const feature of found) {
        for (const path of feature.geometry?.paths ?? []) {
          const geometry = path
            .filter((p): p is readonly [number, number] => Array.isArray(p) && p.length >= 2)
            .map(([lng, lat]): LngLat => [lng, lat]);
          if (geometry.length === 0) continue;
          features.push({
            category: 'pipeline',
            label: source.describe(feature.attributes ?? {}),
            operator: source.publisher,
            geometry,
          });
        }
      }
    } catch {
      anyFailed = true;
    }
  }

  if (features.length > 0) return { kind: 'found', features, publishers: [...publishers] };
  /*
   * A FAILURE OUTRANKS AN EMPTY RESULT when both happened. Reporting "the
   * county publishes nothing here" after a request that never completed would
   * turn an outage into a statement about the land.
   */
  if (anyFailed) return { kind: 'lookup-failed', reason: 'county utility service did not answer' };
  return { kind: 'none-found', coverageNotes };
}
