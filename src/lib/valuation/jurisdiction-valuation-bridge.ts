import type { DispatchResult } from '@/lib/jurisdiction/dispatch-orchestrator';
import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';

/**
 * Phase 2: Jurisdiction-Valuation Bridge
 *
 * Connects county-specific routing (src/lib/jurisdiction) to the valuation
 * module's confidence reporting. A dollar figure derived from a verified
 * county GIS parcel record and one derived from no automated source at all
 * must not be presented identically — this maps routing tier onto the same
 * three-state confidence vocabulary the rest of the app already speaks.
 */

/** Mirrors the blueprint's data_fidelity enum, extended with a third "no source" state. */
export type JurisdictionalConfidenceLevel = 'verified' | 'inferred' | 'flagged';

export interface JurisdictionalValuationContext {
  readonly dispatch: DispatchResult;
  readonly confidence: JurisdictionalConfidenceLevel;
  /** Human-readable provenance, e.g. "Los Angeles County, CA County Assessor GIS". */
  readonly dataSource: string;
  /** Present whenever confidence is not `verified`. */
  readonly caveat?: string;
}

/**
 * Map county agent routing tier to valuation data confidence.
 * - immediate (Tier A): county assessor GIS parcel data      → verified
 * - standard  (Tier B): recorder index API + inferred values → inferred
 * - fallback  (Tier C): no automated source                  → flagged
 */
export function mapJurisdictionToConfidence(
  dispatch: DispatchResult,
): JurisdictionalValuationContext {
  const dataSource = describeDataSource(dispatch);

  switch (dispatch.routingTier) {
    case 'immediate':
      return { dispatch, dataSource, confidence: 'verified' };

    case 'standard':
      return {
        dispatch,
        dataSource,
        confidence: 'inferred',
        caveat:
          `Valuation inputs sourced from ${dataSource} via recorder index API. ` +
          'Area and value figures are inferred from deed instruments rather than a ' +
          'surveyed parcel record; verify with the county assessor before relying on ' +
          'these figures in a compensation negotiation.',
      };

    case 'fallback':
      return {
        dispatch,
        dataSource,
        confidence: 'flagged',
        caveat:
          `No automated record access for ${dispatch.county}, ${dispatch.state}. ` +
          'Valuation figures are illustrative only and are not based on any retrieved ' +
          'county record. Request official assessor records before treating these as an estimate.',
      };
  }
}

/** Human-readable provenance string for the agent backing this dispatch. */
function describeDataSource(dispatch: DispatchResult): string {
  const { county, state, agent } = dispatch;

  switch (agent.type) {
    case 'gis-explorer':
      return `${county}, ${state} County Assessor GIS / Esri MapServer`;
    case 'api-extractor':
      return `${county}, ${state} Recorder Index (${agent.platformName})`;
    case 'foia-generator':
      return `${county}, ${state} Clerk (FOIA request required)`;
    case 'generic':
      return `${county}, ${state} (no mapped record platform)`;
  }
}

/**
 * Wrap a computed valuation figure in the app-wide confidence tier shape so
 * the UI's three-state display can render it alongside Phase 1 findings.
 *
 * Note the asymmetry: a `flagged` result carries no value. That is deliberate
 * and matches `TieredResult` — a figure with no retrieved source behind it
 * must not be surfaced as a number the user can anchor on.
 */
export function valuationConfidenceToTieredResult<TValue>(
  value: TValue,
  context: JurisdictionalValuationContext,
  ruleId = 'jurisdiction-valuation-confidence',
): TieredResult<TValue> {
  switch (context.confidence) {
    case 'verified':
      return { tier: 'clear', ruleId, value };

    case 'inferred':
      return {
        tier: 'likely-with-caveat',
        ruleId,
        value,
        caveat: context.caveat ?? `Valuation inferred from ${context.dataSource}.`,
      };

    case 'flagged':
      return {
        tier: 'flagged-ambiguous',
        ruleId,
        flagReason:
          context.caveat ?? `No automated record source available (${context.dataSource}).`,
      };
  }
}

/**
 * Recommended next step given the jurisdiction's routing tier. Drives the UX
 * choice between Track 1 (paid letter, asserts figures) and Track 2 (free
 * clarification request, asks for them).
 */
export function suggestNextStepByJurisdiction(dispatch: DispatchResult): string {
  switch (dispatch.routingTier) {
    case 'immediate':
      return (
        'Valuation inputs are verified against county GIS parcel data. ' +
        'Track 1 Maintenance Request Letter can assert these figures directly.'
      );

    case 'standard':
      return (
        'Valuation inputs are inferred from county recorder API records. ' +
        'Track 1 is available with a stated caveat, or use Track 2 to request official confirmation.'
      );

    case 'fallback':
      return (
        `No automated valuation data is available for ${dispatch.county}, ${dispatch.state}. ` +
        'Use Track 2 Request for Clarification to obtain official records before asserting any figures.'
      );
  }
}
