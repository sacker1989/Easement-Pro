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
        'OC public Esri REST assessment roll. Layer 0 "LEGAL_LOTS_ATTRIBUTES_UPDATE", polygon, EPSG:2230, carrying AssessmentNo, SiteAddress, SiteZip5, LandVal, ImprovedVal, zoning and geometry for roughly 696,000 parcels (752,064 total records; see limitations on count instability). No API key required. Queried by src/lib/risk-disclosure/orange-county-assessor-provider.ts.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-07-27',
        verifiedVia:
          'Live curl: enumerated the services root, then MapServer/0?f=json for fields and a records query returning real land values (e.g. 1251 N ALAMO ST, 92801, LandVal 531538, area 6278.81 sq ft).',
        limitations:
          'Publishes NO Proposition 13 base year and no roll year. LA County publishes Roll_LandBaseYear, which is what lets a frozen assessment be indexed forward; without it there is no defensible way to tell whether an Orange County figure is current or decades stale. The distortion is visibly present — two comparable ~6,200 sq ft lots on W Huntington Ave carry land values of 243,414 and 531,538 — but it cannot be corrected, so values are reported raw with an explicit caveat. LegalStartDate and DocRefDate are lot and document dates and must NOT be substituted for a base year — LegalStartDate is 1972-02-24 on every sampled record. Confirmed 2026-07-27 that NO assessment vintage exists anywhere in the county’s public GIS, by enumerating all 41 service folders and sweeping every service name; comparing roll vintages to detect reassessment was also tested and fails, as the 2020-2021 roll publishes blank values. A richer layer (Treasurer_Tax_Collector/Secured_Property_Tax_Information, 886,542 parcels with alv > 0, values as Doubles, apn field 100% empty so join on AssessmentNo) is worth migrating to but is unverified for address coverage. The whole ocgis.com server returned HTTP 503 under modest query load, so production use needs caching, backoff and a degraded path. Note also that the county’s headline parcel service (Map_Layers/Parcels) carries no money at all; an earlier pass probed only that service and wrongly recorded the county as having no assessed value.',
      },
    },
  },

  {
    county: 'San Diego County',
    state: 'CA',
    fipsCode: '06073',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl:
        'https://gis-public.sandiegocounty.gov/arcgis/rest/services/LAFCO/parcels/MapServer/0',
      countyGisPortal: 'https://gis-public.sandiegocounty.gov/arcgis/rest/services',
      assessorMapServer: 'LAFCO/parcels',
      description:
        'Public Esri REST assessor parcel layer. Layer 0 "Parcels with APNs", polygon, EPSG:2230, maxRecordCount 1000, 65 fields covering APN, ASR_LAND, ASR_IMPR, ASR_TOTAL (all integers), full SITUS_* address parts, SITUS_ZIP, ACREAGE, OWN_NAME1-3 and OWN_ADDR1-4. 987,889 parcels carry ASR_LAND > 0 of 1,089,648 total. No API key required.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-07-30',
        verifiedVia:
          'Full folder sweep of the services root (25 folders, 48 root services), then MapServer/0?f=json for the field list and record queries returning real values (e.g. APN 4982604500, ASR_LAND 266,867 / ASR_IMPR 88,944, ZIP 92020).',
        limitations:
          'An earlier pass recorded this county as having NO public parcel endpoint, citing code 499 "Token Required" from a different server path. That was wrong — it probed one path and stopped. Two field traps: YEAR_EFFECTIVE is a two-character effective-year-BUILT (observed values include "48" and "40", i.e. pre-Proposition 13) and must NOT be read as an assessment base year. DOCDATE is MMDDYY and populated on 1,088,673 of 1,089,648 parcels. VALIDATED 2026-07-30 as a Prop 13 reassessment-vintage proxy — see docs/validation-sd-docdate.md. Complete enumeration of 97,026 parcels across 8 ZIPs (no sampling) shows assessed value per living sq ft rising 2.18x with DOCDATE recency and land share rising monotonically in all 7 steps, while median effective year built stays FLAT within each ZIP, so the gradient is not newer housing. Dips at 1995 and 2010 coincide with independently measured FHFA troughs, and a Prop 13 model with no fitted parameters agrees within ±8% on six of eight vintage buckets. CONDITIONS OF USE: FIRST, exclude parcels owned by a trust or legal entity even when DOCTYPE=1 — transfers into a trust record as grant deeds but are excluded from Prop 13 reassessment, so the basis never resets; measured at 41-57% of recent grant deeds carrying about half the assessed value per sq ft of comparable individually-owned homes, and applying this lifts cross-path agreement from 45% to 66-69%, level with LA. Then prefer DOCTYPE=1, CONFIRMED 2026-08-01 against the county data dictionary (SanGIS PARCELS metadata) as "Grant deed" — the standard full-value transfer instrument in California — against DOCTYPE=2 "Quit claim", the ordinary instrument for the spousal, parent-child and trust transfers Prop 13 EXCLUDES from reassessment, and DOCTYPE=6 "Trustees deed", a foreclosure conveyance; distrust the 2004-2007 cohort, where Proposition 8 decline-in-value reassessment plausibly explains a 0.61 model ratio; and check new-growth ZIPs such as 92130 where DOCDATE recency is confounded with new construction. The dictionary calls DOCDATE the recording date of the document that "created this parcel", which read literally would mean the subdivision map; that reading was TESTED AND REJECTED 2026-08-01 — grouping by SUBNAME gives 901 distinct DOCDATEs and 1,000 distinct DOCNMBRs across 1,000 parcels of one subdivision spanning 1976-2026, i.e. one document per parcel, so it means the parcel RECORD, which the assessor opens on transfer. DOCDATE does track conveyances. It must NOT be presented as equivalent to LA Roll_LandBaseYear, and its per-parcel reliability is materially weaker than its aggregate gradient suggests. Note also that unlike LA (Gov Code 7928.205) and San Bernardino (AB 1785), this layer publishes owner names and mailing addresses.',
      },
    },
  },

  // ===== TIER B: Standard — human-facing search portals =====
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
          'Re-probed 2026-07-30 with the full discovery procedure: swept all 13 folders of gis.countyofriverside.us/arcgis_public, then checked every candidate (OpenData/ParcelBasic, OpenData/AssessorTables, Transportation_Survey/03_Parcels, 02_LandSurveyRecords, AssessorMapBooks) on both MapServer and FeatureServer.',
        limitations:
          'CONFIRMED unavailable, on stronger evidence than the first pass. Every candidate service advertises Map,Query,Data and enumerates ZERO layers and ZERO tables to anonymous callers; every FeatureServer variant returns error code 500. The sole exception is Transportation_Survey/AssessorMapBooks, which exposes one layer — a map-book index of 14 fields carrying no APN and no values. The pattern is systematic rather than a per-service misconfiguration, so this is treated as policy. An advertised capability that returns nothing is not usable. Contrast San Diego, where the same sweep DID overturn an earlier negative — the procedure was applied identically here and the negative held.',
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

  // ===== FLORIDA — first entry. Phase 2 strand 3 recorded Florida as having
  // zero county routes; this closes that for one jurisdiction.
  {
    county: 'Clay County',
    state: 'FL',
    fipsCode: '12019',
    tier: 'immediate',
    agent: {
      type: 'gis-explorer',
      esriServiceUrl:
        'https://services2.arcgis.com/R0MaBWycrb80Pvlu/arcgis/rest/services/GCS_Parcels/FeatureServer/41',
      countyGisPortal: 'https://services2.arcgis.com/R0MaBWycrb80Pvlu/arcgis/rest/services',
      assessorMapServer: 'GCS_Parcels',
      description:
        'Green Cove Springs (Clay County) public Esri FeatureServer. Layer 41 "GCS_Parcels" is a ' +
        'polygon layer with 133 fields over 4,756 parcels, carrying MktLandVal, JustValue, ' +
        'BldgValue, TaxableVal, UseCode/Usedesc, split address components (HouseNo, StreetName, ' +
        'StreetDir, StreetUnit) and both GISACRES and ACREAGE. No API key required.',
      source: {
        accessMode: 'documented-api',
        verifiedOn: '2026-08-22',
        verifiedVia:
          'Live curl against FeatureServer/41?f=json (133 fields, 4,756 records) and a values ' +
          'query returning real market land values — e.g. parcel 016499-002-00 at MktLandVal ' +
          '1,050,000 over GISACRES 5.273, and 015234-005-62 at 32,838 over 0.2149 acres.',
        limitations:
          'FLORIDA ASSESSES AT JUST VALUE ANNUALLY, so MktLandVal is a current market land value ' +
          'as published and none of the Proposition 13 base-year machinery built for California ' +
          'applies or is needed. ' +
          'AREA UNITS — CHECKED, AND NOT WHAT THE SERVICE METADATA IMPLIES. The layer extent ' +
          'advertises wkid 102100 / latestWkid 3857 (Web Mercator), which would make an ' +
          'ArcGIS-generated Shape__Area square METRES inflated by 1/cos²(latitude), about 1.333x ' +
          'at this latitude. But the stored field here is Shape_STAr (single underscore, ' +
          'shapefile-derived from the source projection) and it is ALREADY SQUARE FEET: verified ' +
          'against GISACRES x 43,560 on four parcels — 66,571 vs 66,571, 229,692 vs 229,692, ' +
          '9,349 vs 9,360, 10,734 vs 10,736. Applying the Web Mercator conversion would inflate ' +
          'every area by 10.76x. Do not infer units from the service SR; check the field. ' +
          'Coverage is the CITY of Green Cove Springs, not all of Clay County, so the tier is ' +
          'accurate for matched parcels and most of the county will not match. Owner name is ' +
          'present as "Name", unlike California, where Gov Code §7928.205 bars it.',
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
