/**
 * Phase 2: County-specific worker sub-agents
 * Inspired by scaffolding blueprint's multi-agent orchestration.
 * Each agent specializes in a platform type and produces standardized output.
 */

export type CountyResolverAgentType = 'gis-explorer' | 'api-extractor' | 'foia-generator' | 'generic';

/**
 * How a jurisdiction's records can actually be reached.
 *
 * This distinction is load-bearing: a URL that renders a search form for a
 * human is not an API. Storing a portal URL in a field called `apiEndpoint`
 * implies a machine contract that mostly does not exist at the county level,
 * and an integration built on that assumption fails at runtime rather than
 * at review time.
 */
export type AccessMode =
  /** Documented REST/JSON endpoint with a stable response contract. */
  | 'documented-api'
  /** Public web portal intended for human search; no published API contract. */
  | 'human-portal'
  /** No online index; physical visit or written request required. */
  | 'in-person-only'
  /** Not yet researched. */
  | 'unknown';

/** Provenance for a routing entry, so unverified data is visibly unverified. */
export interface SourceProvenance {
  readonly accessMode: AccessMode;
  /** ISO date the URLs below were last confirmed to resolve. Omit if never checked. */
  readonly verifiedOn?: string;
  /** Where the value came from, for re-checking later. */
  readonly verifiedVia?: string;
  /** Known legal or practical limits on what this source will return. */
  readonly limitations?: string;
}

/**
 * GIS Explorer Agent: Parses Esri MapServers, county GIS portals, parcel boundaries.
 * Platforms: Esri REST APIs, County assessor GIS, public county mapping portals
 * Output: Georeferenced easement vectors, boundary proximity, JSON metadata
 */
export interface GISExplorerConfig {
  type: 'gis-explorer';
  /** Esri REST service root. Only populate when confirmed to resolve. */
  esriServiceUrl?: string;
  countyGisPortal?: string;
  assessorMapServer?: string;
  description: string;
  source: SourceProvenance;
}

/**
 * Record Index Agent: reaches a county's recorded-document index.
 * Platforms: Tyler Eagle, Acclaim, GSCCCA, PublicSearch, county-built portals
 * Output: Deed document references, covenant clauses, recorded dates, index URLs
 */
export interface APIExtractorConfig {
  type: 'api-extractor';
  platformName: 'tyler-eagle' | 'acclaim' | 'gsccca' | 'publicsearch' | 'county-built' | 'unknown';
  /**
   * Entry point for the index. Named `searchUrl`, not `apiEndpoint`, because
   * for every county currently in the database this is a human-facing search
   * page rather than a documented API — see `source.accessMode`.
   */
  searchUrl: string;
  apiKeyRequired?: boolean;
  description: string;
  source: SourceProvenance;
}

/**
 * FOIA Request Generator Agent: Drafts legal public record request templates.
 * Platforms: Legacy paper records, unmapped county systems
 * Output: State-specific FOIA templates, mailing addresses, request forms
 */
export interface FOIAGeneratorConfig {
  type: 'foia-generator';
  stateName: string;
  /** Statute governing public records access in this state. */
  statePublicRecordsLaw?: { citation: string; url: string };
  /** Counter/inspection address. Distinct from mailing address — they differ. */
  clerkAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  mailingAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  requestProcessingDays?: number;
  description: string;
  source: SourceProvenance;
}

/**
 * Generic Fallback Agent: Handles unknown or unmapped jurisdictions.
 * Carries no county-specific data by design — see dispatch-orchestrator.
 */
export interface GenericFallbackConfig {
  type: 'generic';
  description: string;
}

export type AgentConfig = GISExplorerConfig | APIExtractorConfig | FOIAGeneratorConfig | GenericFallbackConfig;

/**
 * County agent routing entry: maps jurisdiction to a specialized agent.
 */
export interface CountyAgentRoute {
  readonly county: string;
  readonly state: string;
  readonly fipsCode?: string; // FIPS county code for authoritative lookup
  readonly agent: AgentConfig;
  readonly tier: 'immediate' | 'standard' | 'fallback'; // Tier A (immediate) → Tier B (standard) → Fallback
}
