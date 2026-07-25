import type { CountyAgentRoute } from './agent-types';
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
  agent: CountyAgentRoute;
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
 * Main dispatch orchestrator: takes a county+state, routes to appropriate agent.
 * Follows tier-based compliance gating from Phase 1 state-tier system.
 */
export function dispatchToAgent(request: DispatchRequest): DispatchResult {
  const { county, state } = request;

  // Step 1: Try exact match in database
  let route = getCountyAgent(county, state);

  if (!route) {
    // Step 2: Fallback to generic handler (always available)
    const fallbackRoutes = getRoutesByTier('fallback');
    if (fallbackRoutes.length === 0) {
      throw new Error('No fallback agent configured. Database may be incomplete.');
    }
    route = fallbackRoutes[0]!; // Use first fallback (generic)

    return {
      county,
      state,
      agent: route,
      routingTier: 'fallback',
      message: `County "${county}" not explicitly mapped. Using generic fallback handler. Consider adding county-specific route for better integration.`,
    };
  }

  // Step 3: Return matched route with appropriate tier message
  const tierMessages: Record<string, string> = {
    immediate: `Immediate integration available for ${county}, ${state}. Using specialized ${route.agent.type} agent.`,
    standard: `Standard integration available for ${county}, ${state}. Using ${route.agent.type} agent with standard latency.`,
    fallback: `Limited integration for ${county}, ${state}. Using fallback ${route.agent.type} agent. Manual intervention may be required.`,
  };

  return {
    county,
    state,
    agent: route,
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
