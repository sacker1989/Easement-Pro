import type { CountyAgentRoute } from './agent-types';

/**
 * Phase 2: County agent routing database.
 *
 * VERIFICATION STATUS (2026-07-25): every URL below was checked against the
 * live site on that date. An earlier revision of this file contained
 * placeholder URLs that were never verified and were uniformly wrong; the
 * `source` block on each entry now records when and how the value was
 * confirmed so that cannot recur silently.
 *
 * Important: no county in this table exposes a documented public API for
 * recorded documents. Every `searchUrl` is a human-facing search portal.
 * Only Los Angeles County offers a machine-queryable endpoint, and that is
 * parcel geometry (Esri REST), not deed text. Integrations must not assume a
 * JSON contract — check `agent.source.accessMode` first.
 */

export const COUNTY_AGENT_ROUTES: readonly CountyAgentRoute[] = [
  // ===== TIER A: Immediate — machine-queryable =====
  {
    county: 'Los Angeles County',
    state: 'CA',
    fipsCode: '06037',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl:
        'https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Parcel/MapServer/0',
      countyGisPortal: 'https://public.gis.lacounty.gov/public/rest/services',
      assessorMapServer: 'LACounty_Cache/LACounty_Parcel',
      description:
        'LA County public Esri REST parcel service (ArcGIS 10.91, cached). Layer 0 "Parcels" is a polygon feature layer with 92 fields: parcel identity (AIN/APN), situs address, use codes, per-structure square footage and year built, full legal description, current assessor roll values (Roll_LandValue, Roll_ImpValue, Roll_Year), and geometry area via Shape.STArea(). Capabilities Map,Query,Data; maxRecordCount 1000; JSON/geoJSON/PBF.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-07-25',
        verifiedVia:
          'Live curl against MapServer?f=json, MapServer/0?f=json (92-field schema), and MapServer/0/query. Sample: AIN 2004001003 returned Roll_Year 2026, Roll_LandValue 740440, Shape.STArea() 9685.58 sq ft.',
        limitations:
          'No owner name or owner mailing address field exists among the 92 returned — consistent with California Government Code §7928.205, which bars owner identity from public parcel REST endpoints statewide. Owner identity must come from another source before any letter can be addressed. Also carries no easement or deed instrument text; recorded documents require the Registrar-Recorder. Geometry SR is EPSG:2229 (NAD83 California zone 5, US survey feet), so Shape.STArea() is square feet.',
      },
    },
  },

  {
    county: 'Orange County',
    state: 'CA',
    fipsCode: '06059',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl:
        'https://www.ocgis.com/arcpub/rest/services/LegalLotsAttributeOpenData/MapServer/0',
      countyGisPortal: 'https://www.ocgis.com/arcpub/rest/services',
      assessorMapServer: 'LegalLotsAttributeOpenData',
      description:
        'OC public Esri REST assessment roll. Layer 0 "LEGAL_LOTS_ATTRIBUTES_UPDATE", polygon, EPSG:2230, carrying AssessmentNo, SiteAddress, SiteZip5, LandVal, ImprovedVal, zoning and geometry for 912,332 parcels. No API key required. Queried by src/lib/risk-disclosure/orange-county-assessor-provider.ts.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-07-27',
        verifiedVia:
          'Live curl: enumerated the services root, then MapServer/0?f=json for fields and a records query returning real land values (e.g. 1251 N ALAMO ST, 92801, LandVal 531538, area 6278.81 sq ft).',
        limitations:
          'Publishes NO Proposition 13 base year and no roll year. LA County publishes Roll_LandBaseYear, which is what lets a frozen assessment be indexed forward; without it there is no defensible way to tell whether an Orange County figure is current or decades stale. The distortion is visibly present — two comparable ~6,200 sq ft lots on W Huntington Ave carry land values of 243,414 and 531,538 — but it cannot be corrected, so values are reported raw with an explicit caveat. LegalStartDate and DocRefDate are lot and document dates and must NOT be substituted for a base year. Note also that the county’s headline parcel service (Map_Layers/Parcels) carries no money at all; an earlier pass probed only that service and wrongly recorded the county as having no assessed value.',
      },
    },
  },

  // ===== TIER B: Standard — human-facing search portals =====
  {
    county: 'San Diego County',
    state: 'CA',
    fipsCode: '06073',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://arcc.sdcounty.ca.gov/Pages/Recorder.aspx',
      description:
        'San Diego County Assessor/Recorder/County Clerk. Counter at 1600 Pacific Highway, Room 260, San Diego CA 92101.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-27',
        verifiedVia:
          'Probed gis-public.sandiegocounty.gov PARCELS_ALL (returned code 499 "Token Required") and enumerated the SanGIS public services folder.',
        limitations:
          'No public parcel REST endpoint. The county ArcGIS server requires a token, and the SanGIS public folder publishes only basemaps, imagery, jurisdictions and a geocoder — no parcel layer. The recorder search URL is taken from the county site and has not been exercised programmatically.',
      },
    },
  },
  {
    county: 'Riverside County',
    state: 'CA',
    fipsCode: '06065',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://www.rivcoacr.org/',
      description:
        'Riverside County Assessor-County Clerk-Recorder. Counter at 2724 Gateway Drive, Riverside CA 92507.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-27',
        verifiedVia:
          'Probed gis.countyofriverside.us arcgis_public OpenData/AssessorTables and Transportation_Survey/03_Parcels.',
        limitations:
          'Both public ArcGIS services respond and advertise Query capability, but enumerate zero layers and zero tables to anonymous callers, and requesting layer 0 directly returns error code 500. Treated as unavailable rather than as an API — an advertised capability that returns nothing is not usable. Worth re-probing; this may be a misconfiguration rather than a policy.',
      },
    },
  },
  {
    county: 'San Bernardino County',
    state: 'CA',
    fipsCode: '06071',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://arc.sbcounty.gov/official-records/',
      description:
        'San Bernardino County Assessor-Recorder-County Clerk. Document index 1925-present online; contents viewable in person at the Hall of Records, 222 W. Hospitality Lane, San Bernardino CA 92415, or the High Desert Government Center in Hesperia.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-27',
        verifiedVia: 'County open data portal listing and arc.sbcounty.gov/official-records/',
        limitations:
          'The countywide parcel dataset is published open, but address and owner name are REDACTED under California Assembly Bill 1785, so address-to-parcel matching cannot be driven from it. Index searchable online from 1925; document images require an in-person visit.',
      },
    },
  },
  {
    county: 'San Francisco County',
    state: 'CA',
    fipsCode: '06075',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://www.sf.gov/departments--assessor-recorder',
      description:
        'SF Office of the Assessor-Recorder. The former sfassessor.org host now 301-redirects here; no parcel REST endpoint confirmed.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'sfassessor.org/mapping-system returned 301 → www.sf.gov/departments--assessor-recorder',
        limitations: 'No documented API located. Same §7928.205 owner-data restriction applies as a California county.',
      },
    },
  },
  {
    county: 'Cook County',
    state: 'IL',
    fipsCode: '17031',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://www.cookcountyclerkil.gov/recordings/search-recordings',
      description:
        'Cook County Clerk Recordings Division. Free search by PIN, grantor and grantee. Counter at 118 N Clark St, Room 120.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'cookcountyclerkil.gov/recordings',
        limitations:
          'The separate Cook County Recorder of Deeds office was abolished 2020-12-07 and its duties folded into the Clerk. Any integration or copy referring to a "Cook County Recorder" is addressing an office that no longer exists.',
      },
    },
  },
  {
    county: 'Clark County',
    state: 'NV',
    fipsCode: '32003',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'acclaim',
      searchUrl: 'https://recorderecomm.clarkcountynv.gov/AcclaimWeb/',
      description:
        'Clark County Recorder Record Search System (AcclaimWeb). Searchable by name, parcel number, instrument number, document type, book/page and legal description.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'clarkcountynv.gov/government/elected_officials/county_recorder/',
        limitations: 'AcclaimWeb is a session-based ASP.NET search UI, not an API.',
      },
    },
  },
  {
    county: 'Dallas County',
    state: 'TX',
    fipsCode: '48113',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'publicsearch',
      searchUrl: 'https://dallas.tx.publicsearch.us/',
      description:
        'Dallas County Clerk official public records via the PublicSearch portal. Records Building, 500 Elm St, Suite 2100, Dallas TX 75202.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'dallascounty.org/services/record-search/ and dallas.tx.publicsearch.us',
        limitations:
          'Portal vendor is PublicSearch. An earlier revision asserted Tyler Technologies as the platform; that attribution was never substantiated and has been removed rather than guessed at.',
      },
    },
  },
  {
    county: 'Fulton County',
    state: 'GA',
    fipsCode: '13121',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'gsccca',
      searchUrl: 'https://search.gsccca.org/RealEstate/',
      description:
        'Georgia Superior Court Clerks’ Cooperative Authority — statewide real estate index covering all 159 Georgia counties from 1990 forward. County-level office is the Clerk of Superior Court (fultonclerk.org), not a recorder.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'search.gsccca.org/RealEstate/ and fultonclerk.org/143/Deeds-and-Records',
        limitations:
          'GSCCCA coverage starts at 1990; pre-1990 instruments require the Fulton County Deed Room in person (Lewis Slaton Courthouse, $5 per 4 hours).',
      },
    },
  },
  {
    county: 'Harris County',
    state: 'TX',
    fipsCode: '48201',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'county-built',
      searchUrl: 'https://www.cclerk.hctx.net/applications/websearch/RP.aspx',
      description:
        'Harris County Clerk Real Property web search. Counter at 201 Caroline, Suite 460, Houston TX 77002.',
      source: {
        accessMode: 'human-portal',
        verifiedOn: '2026-07-25',
        verifiedVia: 'cclerk.hctx.net/RealProperty.aspx',
        limitations:
          'Reclassified from fallback to standard. The source blueprint characterised Harris County as a legacy/PDF jurisdiction requiring a FOIA request; it in fact operates an online real property search, so routing users here to a mail-in request would have been wrong.',
      },
    },
  },

  // ===== FALLBACK: no online index =====
  {
    county: 'Santa Clara County',
    state: 'CA',
    fipsCode: '06085',
    tier: 'fallback',
    agent: {
      type: 'foia-generator',
      stateName: 'California',
      statePublicRecordsLaw: {
        citation: 'California Public Records Act, Gov. Code §7920 et seq.',
        url: 'https://leginfo.legislature.ca.gov/faces/codesTOCSelected.xhtml?tocCode=GOV&tocTitle=+Government+Code+-+GOV',
      },
      clerkAddress: {
        street: '110 West Tasman Drive, 1st Floor',
        city: 'San Jose',
        state: 'CA',
        zip: '95134',
      },
      description:
        'Santa Clara County Clerk-Recorder. Online search of the Official Record Index has been withdrawn by County Executive directive — records must be researched in person.',
      source: {
        accessMode: 'in-person-only',
        verifiedOn: '2026-07-25',
        verifiedVia: 'clerkrecorder.santaclaracounty.gov/official-records/records-search',
        limitations:
          'Reclassified from immediate to fallback. An earlier revision listed this county as a Tier A real-time integration, which was doubly wrong: the endpoint was invented and the county offers no online index at all. In-person index covers 1981-present by name, AIN or document number.',
      },
    },
  },
];

/**
 * Look up a county agent by county name and state.
 * Returns null when unmapped — callers synthesize a generic fallback.
 */
export function getCountyAgent(county: string, state: string): CountyAgentRoute | null {
  return (
    COUNTY_AGENT_ROUTES.find(
      (route) => route.county.toLowerCase() === county.toLowerCase() && route.state.toUpperCase() === state.toUpperCase(),
    ) || null
  );
}

/**
 * Get all routes by tier (used for Phase 2 gating).
 */
export function getRoutesByTier(tier: 'immediate' | 'standard' | 'fallback'): readonly CountyAgentRoute[] {
  return COUNTY_AGENT_ROUTES.filter((route) => route.tier === tier);
}

/**
 * Get all available counties for a given state.
 */
export function getCountiesForState(state: string): string[] {
  return COUNTY_AGENT_ROUTES.filter((route) => route.state.toUpperCase() === state.toUpperCase()).map(
    (route) => route.county,
  );
}
