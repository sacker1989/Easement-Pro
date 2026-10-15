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

/**
 * WHAT THESE SOURCES DO NOT PUBLISH, checked across all of them rather than
 * assumed, because it was asked for directly and the answer is no.
 *
 * INSTALLATION DATE IS NOT AVAILABLE. Orange carries `InstallDate` and
 * `AsBuiltDate` fields and both are 0% populated across a 300-feature sample.
 * San Diego, LA County and the CEC have no construction-date field at all.
 * Nothing here can say how old a pipe or a line is.
 *
 * CONDITION IS NOT AVAILABLE EITHER. San Diego publishes `SPOT_REPAIRS` and
 * `MAINTENANCE_CODE`, populated on 6% and 8% of records — too sparse to say
 * anything about a particular parcel, and silence in a 92%-empty column is
 * not evidence of good condition.
 *
 * SO NO FAILURE RISK IS COMPUTED, and the reason is the one that governs the
 * screening range and the easement likelihood: a number with no ground truth
 * behind it anchors a reader harder than a caveat can loosen. Predicting that
 * a line will fail in extreme weather would need outage histories matched to
 * assets, which no source here publishes.
 *
 * WHAT IS PUBLISHED AND IS WORTH SAYING: material, on 100% of records
 * everywhere; whether a line is abandoned or in service; and — for
 * transmission — whether it runs OVERHEAD or UNDERGROUND, which is the single
 * most relevant fact this product can report about wildfire exposure, and is
 * stated as a fact rather than a forecast.
 */

/** Sources by county, as `county-dispatch.ts` names them. */
export const COUNTY_UTILITY_SOURCES: Readonly<Record<string, readonly CountyUtilitySource[]>> = {
  'Los Angeles County': [
    {
      layerUrl: 'https://dpw.gis.lacounty.gov/dpw/rest/services/Sewer_Network/MapServer/5',
      outFields: ['PIPE_DIAMETER', 'PIPE_MATERIAL', 'STATUS', 'CITY_OR_COMMUNITY'],
      describe: (a) => {
        const diameter =
          typeof a['PIPE_DIAMETER'] === 'number' && a['PIPE_DIAMETER'] > 0
            ? `${a['PIPE_DIAMETER']}-inch `
            : '';
        /*
         * LA spells its materials out — "VITRIFIED CLAY PIPE" — so they are
         * lower-cased rather than expanded from a code. An unfamiliar value
         * is printed as it stands; guessing at an abbreviation is how a
         * report starts stating things the county did not.
         */
        const material = typeof a['PIPE_MATERIAL'] === 'string' && a['PIPE_MATERIAL'].trim() !== ''
          ? `${a['PIPE_MATERIAL'].toLowerCase().replace(/ pipe$/, '')} `
          : '';
        const status =
          typeof a['STATUS'] === 'string' && a['STATUS'].toUpperCase() !== 'IN SERVICE'
            ? ` (${a['STATUS'].toLowerCase()})`
            : '';
        return `${diameter}${material}gravity sewer main${status}`;
      },
      publisher: 'Los Angeles County Department of Public Works',
      coverage:
        'This layer is LA County Public Works’ own sewer network — the county’s mains, serving ' +
        'unincorporated areas and the cities it contracts with. The City of Los Angeles and many ' +
        'other cities run their own systems and are not in it. Finding nothing here means the ' +
        'county does not maintain sewer at this address, not that there is none.',
    },
  ],
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

/**
 * Sources that are published state-wide rather than county by county.
 *
 * KEYED BY STATE BECAUSE THE PUBLISHER IS A STATE AGENCY. The California
 * Energy Commission maps transmission for the whole of California; listing it
 * under each county separately would imply three datasets where there is one,
 * and would quietly exclude any California county added later.
 *
 * WHY THIS BEATS THE ALTERNATIVES, measured rather than assumed. HIFLD's
 * transmission layer returned `OWNER: "NOT AVAILABLE"` on every feature near
 * the test parcel. OpenStreetMap carries operator on some lines and nothing
 * on others. The CEC layer has kV, Owner, Status and Type populated on 100%
 * of a 300-feature sample: "220kV OH SCE, Operational".
 */
export const STATE_UTILITY_SOURCES: Readonly<Record<string, readonly CountyUtilitySource[]>> = {
  CA: [
    {
      layerUrl:
        'https://services3.arcgis.com/bWPjFyq029ChCGur/arcgis/rest/services/Transmission_Line/FeatureServer/2',
      outFields: ['Name', 'kV', 'Owner', 'Status', 'Type'],
      describe: (a) => {
        const kv = typeof a['kV'] === 'number' && a['kV'] > 0 ? `${a['kV']}kV ` : '';
        /*
         * OVERHEAD VERSUS UNDERGROUND IS THE POINT, and it is why this source
         * is here at all. This product's second pillar is what happens when a
         * utility corridor is not maintained, and the motivating cases were
         * wildfires started by overhead equipment. An overhead line is a
         * different thing to live beside from a buried one, and the CEC says
         * which on every record. It is reported as the fact it is — not as a
         * prediction about what the line will do.
         */
        const type =
          { OH: 'overhead', UG: 'underground' }[String(a['Type'] ?? '')] ?? '';
        const owner = typeof a['Owner'] === 'string' && a['Owner'].trim() !== '' ? ` (${a['Owner']})` : '';
        const status =
          typeof a['Status'] === 'string' && a['Status'] !== 'Operational'
            ? ` — ${a['Status'].toLowerCase()}`
            : '';
        return `${kv}${type ? `${type} ` : ''}electricity transmission line${owner}${status}`;
      },
      publisher: 'California Energy Commission',
      coverage:
        'This layer is the California Energy Commission’s map of TRANSMISSION lines — the high ' +
        'voltage towers that move power between regions. It does not include distribution: the ' +
        'poles and wires along ordinary streets, which is what most homes are served by and what ' +
        'most utility easements concern. Finding no transmission line here is the normal case and ' +
        'says nothing about the lines on your street.',
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
  /** Two-letter state code, for sources published state-wide. */
  readonly state: string;
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
  /*
   * COUNTY AND STATE SOURCES TOGETHER. A county sewer layer and a state
   * transmission layer answer different questions and neither substitutes
   * for the other, so both are queried and the findings merge.
   */
  const sources = [
    ...(COUNTY_UTILITY_SOURCES[query.county] ?? []),
    ...(STATE_UTILITY_SOURCES[query.state] ?? []),
  ];
  if (sources.length === 0) return { kind: 'no-source' };

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
