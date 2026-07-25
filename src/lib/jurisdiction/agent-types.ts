/**
 * Phase 2: County-specific worker sub-agents
 * Inspired by scaffolding blueprint's multi-agent orchestration.
 * Each agent specializes in a platform type and produces standardized output.
 */

export type CountyResolverAgentType = 'gis-explorer' | 'api-extractor' | 'foia-generator' | 'generic';

/**
 * GIS Explorer Agent: Parses Esri MapServers, county GIS portals, parcel boundaries.
 * Platforms: Esri REST APIs, County assessor GIS, public county mapping portals
 * Output: Georeferenced easement vectors, boundary proximity, JSON metadata
 */
export interface GISExplorerConfig {
  type: 'gis-explorer';
  esriServiceUrl?: string;
  countyGisPortal?: string;
  assessorMapServer?: string;
  description: string;
}

/**
 * API Extractor Agent: Connects to index APIs to pull deed instruments.
 * Platforms: Tyler Tech, qPublic, Avenu, county recorder index servers
 * Output: Deed document references, covenant clauses, recorded dates, index URLs
 */
export interface APIExtractorConfig {
  type: 'api-extractor';
  platformName: 'tyler-tech' | 'qpublic' | 'avenu' | 'generic-index';
  apiEndpoint: string;
  apiKeyRequired?: boolean;
  recordIndexPath?: string;
  description: string;
}

/**
 * FOIA Request Generator Agent: Drafts legal public record request templates.
 * Platforms: Legacy paper records, unmapped county systems
 * Output: State-specific FOIA templates, mailing addresses, request forms
 */
export interface FOIAGeneratorConfig {
  type: 'foia-generator';
  stateName: string;
  statePIAUrl?: string;
  clerkAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  requestProcessingDays?: number;
  description: string;
}

/**
 * Generic Fallback Agent: Handles unknown or unmapped jurisdictions.
 * Provides basic record location guidance without specialized integration.
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
