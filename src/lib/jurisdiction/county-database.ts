import type { CountyAgentRoute } from './agent-types';

/**
 * Phase 2: County agent routing database
 * Maps jurisdictions to specialized worker agents per the scaffolding blueprint.
 * Phase 1 only uses CA Tier A; Phase 2 expands to multi-state with county-specific routing.
 */

export const COUNTY_AGENT_ROUTES: readonly CountyAgentRoute[] = [
  // ===== TIER A: Immediate (Full Integration) =====
  // California: LA County (Phase 1 fallback), SF Bay, San Diego expanded in Phase 2
  {
    county: 'Los Angeles County',
    state: 'CA',
    fipsCode: '06037',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl: 'https://services.arcgis.com/...',
      countyGisPortal: 'https://lacounty.gov/assessor/mapping',
      assessorMapServer: 'LAC_Assessor_Parcels',
      description: 'LA County Assessor GIS portal and Esri MapServers',
    },
  },
  {
    county: 'San Francisco County',
    state: 'CA',
    fipsCode: '06075',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl: 'https://sfgov-2.cloudapps.sfgov.org/arcgis/...',
      countyGisPortal: 'https://sfassessor.org/mapping-system',
      assessorMapServer: 'SF_Assessor_Parcels',
      description: 'SF Assessor Office online mapping system',
    },
  },
  {
    county: 'Santa Clara County',
    state: 'CA',
    fipsCode: '06085',
    tier: 'immediate',
    agent: {
      type: 'api-extractor',
      platformName: 'generic-index',
      apiEndpoint: 'https://recorder.sccgov.org/oncore/...',
      recordIndexPath: '/recorder/index',
      description: 'Santa Clara County Recorder index API',
    },
  },

  // ===== TIER B: Standard (API / Fallback Integration) =====
  // Tyler Tech counties: Fulton GA, Dallas TX, Cook IL, Clark NV
  {
    county: 'Fulton County',
    state: 'GA',
    fipsCode: '13121',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'tyler-tech',
      apiEndpoint: 'https://recorder.fulton.county.gov/api',
      apiKeyRequired: true,
      recordIndexPath: '/deed-search',
      description: 'Fulton County (GA) Tyler Tech recorder system',
    },
  },
  {
    county: 'Dallas County',
    state: 'TX',
    fipsCode: '48113',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'tyler-tech',
      apiEndpoint: 'https://www.dallascountyrecords.org/api',
      apiKeyRequired: true,
      recordIndexPath: '/search',
      description: 'Dallas County (TX) Tyler Tech recorder system',
    },
  },
  {
    county: 'Cook County',
    state: 'IL',
    fipsCode: '17031',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'tyler-tech',
      apiEndpoint: 'https://recorder.cookcountyclerk.com/api',
      apiKeyRequired: true,
      recordIndexPath: '/recorder-search',
      description: 'Cook County (IL) Clerk recorder system',
    },
  },
  {
    county: 'Clark County',
    state: 'NV',
    fipsCode: '32003',
    tier: 'standard',
    agent: {
      type: 'api-extractor',
      platformName: 'qpublic',
      apiEndpoint: 'https://records.clarkcountycourts.us/records',
      recordIndexPath: '/deed-index',
      description: 'Clark County (NV) public records via qPublic',
    },
  },

  // ===== FALLBACK: Legacy / Unmapped Systems =====
  // Harris County TX: FOIA-based fallback (legacy paper + digital hybrid)
  {
    county: 'Harris County',
    state: 'TX',
    fipsCode: '48201',
    tier: 'fallback',
    agent: {
      type: 'foia-generator',
      stateName: 'Texas',
      statePIAUrl: 'https://capitol.texas.gov/tlodocs/87R/billtext/html/HB00662E.htm',
      clerkAddress: {
        street: '201 Caroline St',
        city: 'Houston',
        state: 'TX',
        zip: '77002',
      },
      requestProcessingDays: 10,
      description: 'Harris County Clerk legacy system with FOIA fallback',
    },
  },

  // Generic fallback for any unmapped county
  // (catch-all, matched by state-level router)
];

/**
 * Look up a county agent by county name and state.
 * Falls back to generic handler if not found.
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
