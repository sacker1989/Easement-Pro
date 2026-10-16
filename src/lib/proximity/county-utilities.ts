import { createResilientFetch } from '@/lib/net/resilient-fetch';
import type { LngLat } from '@/lib/geo/planar-distance';
import type {
  GeometryQuality,
  InfrastructureCategory,
  InfrastructureFeature,
} from './infrastructure';

/**
 * Utility infrastructure published by the public agency that records it.
 *
 * "COUNTY" IN THE FILENAME IS NOW A MISNOMER, kept because renaming it buys
 * nothing. Three kinds of publisher live here: a county department (LA County
 * DPW, San Diego County DPW, Orange County Public Works), a city department
 * (City of Los Angeles Sanitation), and a state agency compiling lines it does
 * not own (the California Energy Commission). The distinction is not cosmetic
 * — it decides which office a reader rings — so nothing rendered from these
 * entries may describe a publisher as "the county". See the attribution note
 * in app/report/infrastructure-section.tsx, where exactly that shipped.
 *
 * WHY THIS EXISTS ALONGSIDE OPENSTREETMAP. OSM maps long-distance
 * transmission well and ordinary residential distribution poorly — measured
 * repeatedly, and the reason the scan's commonest answer is "nothing mapped".
 * Where a county publishes its own utility network the difference is not
 * marginal: near four parcels in unincorporated Lakeside, OSM returned zero
 * features and San Diego County's sewer layer returned twenty-two to
 * twenty-nine, each with a diameter, a material and a facility id.
 *
 * AUTHORITATIVE, AND STILL NOT A DEED. A sewer layer is its operator's own
 * record of its own pipes, which is a far stronger thing than a volunteer
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
  /**
   * What kind of thing this layer carries.
   *
   * Previously hardcoded to 'pipeline' for every source, which was already
   * wrong for the transmission layers and would have become wrong in a way
   * someone relied on. Nothing reads it yet; it is set correctly now so that
   * whatever reads it first is not reading a lie.
   */
  readonly category: InfrastructureCategory;
  /**
   * Whether this layer's positions are surveyed or reconstructed, per record.
   *
   * A FUNCTION, NOT A CONSTANT, because the federal transmission layer mixes
   * both in one table and flags them individually — 88% inferred in Cook
   * County, 1.5% in Los Angeles. A per-layer constant would have to pick one
   * and be wrong for most of the rows in at least one county.
   */
  readonly quality: (attributes: Readonly<Record<string, unknown>>) => GeometryQuality;
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
      category: 'pipeline',
      // An as-built utility record: the operator is asserting where its own pipe is.
      quality: () => 'mapped',
      publisher: 'Los Angeles County Department of Public Works',
      coverage:
        'This layer is LA County Public Works’ own sewer network — the county’s mains, serving ' +
        'unincorporated areas and the cities it contracts with. Many cities run their own systems ' +
        'and are not in it. Finding nothing here means the county does not maintain sewer at this ' +
        'address, not that there is none.',
    },
    {
      /*
       * THE CITY OF LOS ANGELES, WHICH THE COUNTY LAYER DOES NOT COVER.
       *
       * The county serves unincorporated areas and contract cities. The City
       * of LA runs its own sewers and is the largest population centre in the
       * county by a wide margin — so the county layer alone left the single
       * biggest group of users in the product's best-covered county with
       * "nothing is mapped". 8321 Faust Ave, the test address used all week,
       * is in Canoga Park and returned nothing from the county; the city
       * layer has an 8-inch VCP main in Faust Ave itself.
       *
       * 162,433 pipes with size, material, shape and street name.
       *
       * LATERALS ARE DELIBERATELY NOT WIRED. The same service publishes
       * 539,352 sewer laterals, and a lateral crossing your parcel is your
       * own connection to the main — every house has one, so the finding
       * would fire on essentially every address and imply an encumbrance
       * where there is none. A lateral serving a DIFFERENT property across
       * your land would be a real easement question, and nothing in the data
       * distinguishes the two.
       */
      layerUrl: 'https://maps.lacity.org/lahub/rest/services/Sewer_Information/MapServer/9',
      outFields: ['PIPE_SIZE', 'PIPE_MAT', 'PIPE_SHAPE', 'STREET'],
      describe: (a) => {
        const size =
          typeof a['PIPE_SIZE'] === 'number' && a['PIPE_SIZE'] > 0 ? `${a['PIPE_SIZE']}-inch ` : '';
        const material =
          { VCP: 'vitrified clay', RCP: 'reinforced concrete', DIP: 'ductile iron', PVC: 'PVC' }[
            String(a['PIPE_MAT'] ?? '')
          ] ?? '';
        const street =
          typeof a['STREET'] === 'string' && a['STREET'].trim() !== ''
            ? ` in ${a['STREET'].trim()}`
            : '';
        return `${size}${material ? `${material} ` : ''}sewer main${street}`;
      },
      category: 'pipeline',
      // An as-built utility record: the operator is asserting where its own pipe is.
      quality: () => 'mapped',
      publisher: 'City of Los Angeles Sanitation',
      coverage:
        'This layer is the City of Los Angeles’ own sewer network. It covers the city only — not ' +
        'the eighty-odd other cities in the county, and not unincorporated areas. Finding nothing ' +
        'here means the city does not maintain sewer at this address, which for most of the ' +
        'county is simply because the address is not in the city.',
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
      category: 'pipeline',
      // An as-built utility record: the operator is asserting where its own pipe is.
      quality: () => 'mapped',
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
      category: 'pipeline',
      // An as-built utility record: the operator is asserting where its own pipe is.
      quality: () => 'mapped',
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
      category: 'overhead-power',
      /*
       * SURVEYED, AND THE UNDERGROUND RECORDS ARE TOO. The CEC layer carries
       * no inference flag and is compiled from the utilities' own filings of
       * their own corridors. Note the category is 'overhead-power' for the
       * layer as a whole while `describe` reads Type per record — the
       * category is what the layer is for, not a claim about each row.
       */
      quality: () => 'mapped',
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

/**
 * Sources that cover the whole country, queried whatever the address.
 *
 * WHY THIS TIER EXISTS. Cook County was the one served county with no agency
 * utility source at all — every Chicago address fell back to OpenStreetMap
 * alone. The gap is not an oversight to be fixed by looking harder: Cook
 * County's GIS has no utility network (its "Utilities" folder is Esri's
 * geometry and printing services), the Chicago data portal publishes no sewer
 * or water main geometry, and MWRD — which actually operates the interceptors
 * — publishes watersheds, outfalls and treatment plants but no pipe
 * alignments. Three hosts checked, by name, on 2026-10-15. Chicago withholds
 * buried utility geometry; Los Angeles happens to publish it.
 *
 * What IS available nationally is the federal transmission layer, which is
 * what closes the Illinois gap — not for sewers, which remain unavailable
 * there, but for the overhead lines this product's safety pillar is about.
 */
export const NATIONAL_UTILITY_SOURCES: readonly CountyUtilitySource[] = [
  {
    layerUrl:
      'https://services1.arcgis.com/Hp6G80Pky0om7QvQ/arcgis/rest/services/Electric_Power_Transmission_Lines/FeatureServer/0',
    outFields: ['OWNER', 'VOLTAGE', 'VOLT_CLASS', 'TYPE', 'STATUS', 'INFERRED'],
    describe: (a) => {
      const kv = typeof a['VOLTAGE'] === 'number' && a['VOLTAGE'] > 0 ? `${a['VOLTAGE']}kV ` : '';
      /*
       * TYPE READS "AC; OVERHEAD" OR "AC; UNDERGROUND" — the same
       * overhead-versus-buried fact the CEC layer gives, and the one that
       * matters most to a reader living beside it.
       */
      const raw = String(a['TYPE'] ?? '').toUpperCase();
      const type = raw.includes('UNDERGROUND')
        ? 'underground '
        : raw.includes('OVERHEAD')
          ? 'overhead '
          : '';
      /*
       * "NOT AVAILABLE" IS A LITERAL VALUE IN THIS COLUMN, not a null, and it
       * appears on real rows — three of the eight sampled near Chicago. Left
       * in, it would render "(NOT AVAILABLE)" as if it were an operator's
       * name. An unnamed owner is reported as unnamed by saying nothing.
       */
      const rawOwner = String(a['OWNER'] ?? '').trim();
      const owner =
        rawOwner !== '' && rawOwner.toUpperCase() !== 'NOT AVAILABLE' ? ` (${rawOwner})` : '';
      const status =
        typeof a['STATUS'] === 'string' && a['STATUS'].toUpperCase() !== 'IN SERVICE'
          ? ` — ${a['STATUS'].toLowerCase()}`
          : '';
      return `${kv}${type}electricity transmission line${owner}${status}`;
    },
    category: 'overhead-power',
    /*
     * THE WHOLE REASON GeometryQuality EXISTS. This layer flags each record,
     * and the flag is not a rounding error: 453 of 517 lines intersecting
     * Cook County are INFERRED='Y', against 3 of 205 in Los Angeles and 0 of
     * 60 in San Diego. An inferred route was reconstructed from aerial
     * imagery and EIA filings, and `assessEvidenceTier` refuses to turn one
     * into a tier A or B claim about a particular lot.
     */
    quality: (a) => (String(a['INFERRED'] ?? '').toUpperCase() === 'Y' ? 'inferred' : 'mapped'),
    publisher: 'U.S. Homeland Infrastructure Foundation-Level Data (HIFLD)',
    coverage:
      'This is the federal map of high voltage TRANSMISSION lines, which covers the whole ' +
      'country. It does not include distribution — the poles and wires along ordinary streets, ' +
      'which serve most homes and are what most utility easements concern — and it does not ' +
      'include sewers, water or gas. Finding no transmission line here is the normal case for a ' +
      'residential address. Where a sewer layer is not listed above, no agency publishes one for ' +
      'that area: Chicago and Cook County do not publish buried utility geometry at all.',
  },
];

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
    ...NATIONAL_UTILITY_SOURCES,
  ];
  /*
   * 'no-source' IS NOW UNREACHABLE, and the case is kept rather than removed.
   * A national source means every address has at least one layer queried, so
   * this branch cannot fire today. It stays because the alternative is a
   * caller that handles three outcomes where the type says four, and because
   * the national source is one URL away from being withdrawn.
   */
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
            category: source.category,
            label: source.describe(feature.attributes ?? {}),
            operator: source.publisher,
            geometry,
            geometryQuality: source.quality(feature.attributes ?? {}),
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
