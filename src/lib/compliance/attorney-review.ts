/**
 * Attorney review flow, distinct by tier per docs/development-strategy-v2.md:
 * Tier A gets the opt-in Attorney Review Add-on ("Send without review" must
 * be a real, unshamed, equally-weighted option — no dark patterns); Tier B
 * gets mandatory review with no decline path, structurally present even
 * though no Tier B state is enabled in Phase 1 MVP.
 */

export type AttorneyReviewChoice = 'declined' | 'added';

export interface AttorneyReviewDecision {
  requiredFlow: 'licensed-pathway' | 'mandatory-review';
  choice: AttorneyReviewChoice;
  status: 'pending' | 'not-required';
}

/**
 * Resolves the attorney-review decision for a Track 1 send. For
 * mandatory-review (Tier B), the choice is forced to 'added' regardless of
 * what's passed in — there is no decline path. For licensed-pathway (Tier
 * A), the caller's choice governs, defaulting to 'declined' only because
 * that's the safe default for an unanswered form field, not because
 * declining is discouraged.
 */
export function resolveAttorneyReviewDecision(
  requiredFlow: 'licensed-pathway' | 'mandatory-review',
  userChoice?: AttorneyReviewChoice,
): AttorneyReviewDecision {
  if (requiredFlow === 'mandatory-review') {
    return { requiredFlow, choice: 'added', status: 'pending' };
  }
  const choice = userChoice ?? 'declined';
  return { requiredFlow, choice, status: choice === 'added' ? 'pending' : 'not-required' };
}

export function buildAttorneyReviewStatusLine(decision: AttorneyReviewDecision): string {
  if (decision.requiredFlow === 'mandatory-review') {
    return 'Attorney review status: mandatory review required before sending in this state.';
  }
  if (decision.choice === 'added') {
    return 'Attorney review status: review requested, pending before sending.';
  }
  return "Attorney review status: sent without attorney review, at the sender's choice.";
}
