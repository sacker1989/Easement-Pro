import type { StateComplianceEntry } from './state-tier-config';

/**
 * Whole-feature gate for Track 1 (Advocacy Wizard): is it offered at all in
 * this state, and if so, which required flow applies? Distinct from
 * per-field gating (see gate-wizard-field.ts) — this decides whether the
 * wizard is offered at all, not which specific findings within it can be
 * asserted in a letter.
 *
 * Per docs/development-strategy-v2.md: "no state beyond CA should be enabled
 * for Track 1 until [counsel] review is done," so any UNCLASSIFIED or Tier C
 * state is unavailable, and the messaging must read as an honest capability
 * boundary — not an error or a paywall.
 */
export type AdvocacyWizardAccessDecision =
  | {
      available: true;
      requiredFlow: 'licensed-pathway' | 'mandatory-review';
      stateCompliance: StateComplianceEntry;
    }
  | {
      available: false;
      message: string;
      stateCompliance: StateComplianceEntry;
    };

function buildUnavailableMessage(stateCompliance: StateComplianceEntry): string {
  return (
    `Generating document-specific correspondence in ${stateCompliance.state} requires a level ` +
    'of legal review this platform has not yet completed for that state. You can still use ' +
    'Request for Clarification (Track 2) or the risk-disclosure report (Track 3) for this ' +
    'property, or consult a licensed attorney in your state.'
  );
}

export function evaluateAdvocacyWizardAccess(
  stateCompliance: StateComplianceEntry,
): AdvocacyWizardAccessDecision {
  if (stateCompliance.track1RequiredFlow === 'unavailable') {
    return {
      available: false,
      message: buildUnavailableMessage(stateCompliance),
      stateCompliance,
    };
  }
  return {
    available: true,
    requiredFlow: stateCompliance.track1RequiredFlow,
    stateCompliance,
  };
}
