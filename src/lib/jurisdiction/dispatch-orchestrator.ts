import type { AgentConfig, CountyAgentRoute } from './agent-types';
import { getCountyAgent, getRoutesByTier } from './county-database';

/**
 * Phase 2: Jurisdiction Dispatch Orchestrator
 * Routes address/county lookups to appropriate worker sub-agents based on platform capability.
 * Integrates with Phase 1 address resolution and state-tier compliance gating.
 */

export interface DispatchRequest {
  county: string;
  state: string;
  address?: string; // Used for fallback matching if county lookup fails
}

export interface DispatchResult {
  county: string;
  state: string;
  /** The agent configuration to act on. Flattened from `route.agent` for ergonomics. */
  agent: AgentConfig;
  /** Full routing entry, including FIPS code and tier metadata. */
  route: CountyAgentRoute;
  routingTier: 'immediate' | 'standard' | 'fallback';
  message: string; // Explanation of routing decision
}

export class JurisdictionNotFoundError extends Error {
  constructor(county: string, state: string) {
    super(`No routing found for ${county}, ${state}. Using generic fallback.`);
    this.name = 'JurisdictionNotFoundError';
  }
}

/**
 * Build a generic fallback route for an unmapped jurisdiction.
 *
 * Deliberately synthesized per-request rather than borrowing an existing
 * fallback entry from the database: those entries carry county-specific data
 * (e.g. the Harris County clerk's Houston mailing address), and handing that
 * to a user in an unrelated county would emit a confidently wrong address.
 * The generic agent carries no address at all.
 */
function buildGenericFallbackRoute(county: string, state: string): CountyAgentRoute {
  return {
    county,
    state,
    tier: 'fallback',
    agent: {
      type: 'generic',
      description: `No mapped record platform for ${county}, ${state}. Manual record lookup required.`,
    },
  };
}

/**
 * Main dispatch orchestrator: takes a county+state, routes to appropriate agent.
 * Follows tier-based compliance gating from Phase 1 state-tier system.
 */
export function dispatchToAgent(request: DispatchRequest): DispatchResult {
  const { county, state } = request;

  // Step 1: Try exact match in database
  const route = getCountyAgent(county, state);

  if (!route) {
    // Step 2: Synthesize a generic fallback carrying no county-specific data.
    const genericRoute = buildGenericFallbackRoute(county, state);

    return {
      county,
      state,
      agent: genericRoute.agent,
      route: genericRoute,
      routingTier: 'fallback',
      message: `County "${county}" not explicitly mapped. Using generic fallback handler. Consider adding county-specific route for better integration.`,
    };
  }

  // Step 3: Return matched route with appropriate tier message
  const tierMessages: Record<CountyAgentRoute['tier'], string> = {
    immediate: `Immediate integration available for ${county}, ${state}. Using specialized ${route.agent.type} agent.`,
    standard: `Standard integration available for ${county}, ${state}. Using ${route.agent.type} agent with standard latency.`,
    fallback: `Limited integration for ${county}, ${state}. Using fallback ${route.agent.type} agent. Manual intervention may be required.`,
  };

  return {
    county,
    state,
    agent: route.agent,
    route,
    routingTier: route.tier,
    message: tierMessages[route.tier],
  };
}

/**
 * Batch dispatch: route multiple counties at once.
 * Useful for multi-parcel queries or portfolio analysis.
 */
export function dispatchMultiple(requests: DispatchRequest[]): DispatchResult[] {
  return requests.map((req) => dispatchToAgent(req));
}

/**
 * Tier summary: show coverage across Tier A, B, and Fallback.
 * Used for Phase 2 feature availability gating.
 */
export interface TierCoverageSummary {
  tierA: { count: number; states: string[] };
  tierB: { count: number; states: string[] };
  fallback: { count: number; states: string[] };
  totalCounties: number;
}

export function getTierCoverageSummary(): TierCoverageSummary {
  const tierA = getRoutesByTier('immediate');
  const tierB = getRoutesByTier('standard');
  const fallback = getRoutesByTier('fallback');

  const extractStates = (routes: readonly CountyAgentRoute[]) => [
    ...new Set(routes.map((r) => r.state)),
  ].sort();

  return {
    tierA: { count: tierA.length, states: extractStates(tierA) },
    tierB: { count: tierB.length, states: extractStates(tierB) },
    fallback: { count: fallback.length, states: extractStates(fallback) },
    totalCounties: tierA.length + tierB.length + fallback.length,
  };
}
