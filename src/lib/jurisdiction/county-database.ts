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
        'LA County public Esri REST parcel service. Exposes AIN, APN and SitusFullAddress for ~2.4M parcels; cache refreshed weekly, assessor data monthly.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-07-25',
        verifiedVia: 'ArcGIS REST Services Directory listing for LACounty_Cache/LACounty_Parcel',
        limitations:
          'California Government Code §7928.205 bars owner name and mailing address from public REST parcel endpoints statewide. This service returns parcel identity and situs address only — owner identity must come from another source before any letter can be addressed to an owner.',
      },
    },
  },

  // ===== TIER B: Standard — human-facing search portals =====
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
