import type { StateComplianceEntry } from './state-tier-config';
import { COMPLIANCE_GAPS } from './compliance-gaps';
import { NO_SCOPE, resolveUplAuthorisation, type UplAuthorisation, type UplScope } from './upl-review';

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
 *
 * IT NOW CONSULTS THE UPL REVIEW, which it did not before, and that is the
 * substance of this change. The gap registry's own words: "A compliance
 * control that is never consulted is not a control." `lastReviewedDate` was
 * declared, documented as required, and read by nothing.
 *
 * AND CALIFORNIA DID NOT GO DARK, which is the part worth being precise
 * about. The obvious implementation — refuse when no review exists — was
 * written and reverted once before, because fail-closed is correct for a
 * compliance control and it takes the only live Track 1 product offline. The
 * product owner declined that on 2026-08-22 and the decision stands.
 *
 * So the gate does something better than either option. It CONSULTS the
 * review, finds none, and then looks for a dated acceptance by a named owner
 * in COMPLIANCE_GAPS. Track 1 stays available only because that acceptance
 * exists — not because nobody checked. The difference is invisible in
 * behaviour and total in meaning: remove the acceptance and California goes
 * dark on the next request, which is exactly what a control should do.
 */
export type AdvocacyWizardAccessDecision =
  | {
      available: true;
      requiredFlow: 'licensed-pathway' | 'mandatory-review';
      stateCompliance: StateComplianceEntry;
      /** The review outcome, carried so the UI and audit trail can branch. */
      upl: UplAuthorisation;
      /**
       * True when Track 1 is available DESPITE a refused UPL authorisation,
       * on the strength of a recorded risk acceptance.
       *
       * Deliberately not folded into `available`. "Authorised" and "operating
       * on an accepted risk" produce identical behaviour and are different
       * statements about the world, which is the distinction compliance-gaps.ts
       * exists to preserve. An audit record needs both.
       */
      operatingUnderAcceptedRisk: boolean;
      /** The gap id carrying the acceptance, when operating under one. */
      acceptedUnderGapId: string | null;
      /** What the product may actually do. NO_SCOPE while unreviewed. */
      scope: UplScope;
    }
  | {
      available: false;
      message: string;
      stateCompliance: StateComplianceEntry;
      upl: UplAuthorisation;
      scope: UplScope;
    };

/**
 * The gap whose acceptance authorises operating a state's Track 1 without a
 * UPL review, if one is on record.
 *
 * Looked up rather than hardcoded, so the override lives where the decision
 * was made — with its date, its owner and the event that reopens it — instead
 * of as a condition in this file that nobody would find.
 */
function acceptanceFor(state: string): string | null {
  const gap = COMPLIANCE_GAPS.find(
    (g) =>
      g.id === 'LASTREVIEWEDDATE-NOT-ENFORCED' &&
      g.closed === undefined &&
      g.riskAccepted !== undefined &&
      (g.appliesTo === 'all' || g.appliesTo.includes(state)),
  );
  return gap?.id ?? null;
}

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
  today: string = new Date().toISOString().slice(0, 10),
): AdvocacyWizardAccessDecision {
  const state = stateCompliance.state.trim().toUpperCase();
  const upl = resolveUplAuthorisation(state, stateCompliance.uplReview, today);

  if (stateCompliance.track1RequiredFlow === 'unavailable') {
    return {
      available: false,
      message: buildUnavailableMessage(stateCompliance),
      stateCompliance,
      upl,
      scope: upl.scope,
    };
  }

  if (upl.status === 'authorised') {
    return {
      available: true,
      requiredFlow: stateCompliance.track1RequiredFlow,
      stateCompliance,
      upl,
      operatingUnderAcceptedRisk: false,
      acceptedUnderGapId: null,
      scope: upl.scope,
    };
  }

  // No review. Available ONLY on a recorded acceptance — see the header.
  const acceptedUnder = acceptanceFor(state);
  if (acceptedUnder === null) {
    return {
      available: false,
      message: buildUnavailableMessage(stateCompliance),
      stateCompliance,
      upl,
      scope: NO_SCOPE,
    };
  }

  return {
    available: true,
    requiredFlow: stateCompliance.track1RequiredFlow,
    stateCompliance,
    upl,
    operatingUnderAcceptedRisk: true,
    acceptedUnderGapId: acceptedUnder,
    // NO_SCOPE, not the expected scope. An acceptance is a decision to keep
    // an existing feature running; it is not an opinion, and it cannot widen
    // what the product is permitted to do. `uplDirection.expectedScope` is
    // what the owner anticipates counsel will approve, and nothing reads it.
    scope: NO_SCOPE,
  };
}
