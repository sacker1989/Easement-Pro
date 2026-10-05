import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import { basisSummary } from '@/lib/gating/regulatory-basis';
import { COMMERCE_ENABLED } from './commerce-mode';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';
import type { AttorneyReviewDecision } from './attorney-review';
import type { RuleSetResolution } from '@/lib/analysis-layer/rule-set';
import type { RuleClaimType } from '@/lib/analysis-layer/confidence-tiering';

/**
 * The audit trail: what was true at the moment an artefact was generated.
 *
 * THE REQUIREMENT THIS SERVES is stated in the strategy doc as "linking every
 * sent letter to the tier and compliance basis active at generation time." The
 * operative word is ACTIVE. A tier can change, a review can expire, a statute
 * can be amended, and a disclaimer can be rewritten — and none of that may make
 * it unanswerable what governed a letter that went out last March. So every
 * field here records a value rather than a reference to something that could
 * later move.
 *
 * PHASE 3 ADDED THE ANALYSIS-LAYER HALF. The record previously captured only
 * the UPL side — which tier permitted the letter — and said nothing about
 * whether the substantive analysis behind it rested on a reviewed rule set.
 * Those are separate gates with separate reviewers, so an audit trail carrying
 * one and not the other can answer "were we allowed to send this" but not "on
 * what basis did we say what we said."
 */
export interface SendAuditRecord {
  /**
   * Widened beyond the two Track 1/2 letters for Phase 5. A referral package
   * and a records request are both generated artefacts that carry the
   * disclaimer version and the compliance basis active at generation time,
   * which is the whole reason this record exists — the audit trail should not
   * have a hole shaped like the two artefacts a professional actually receives.
   */
  letterType:
    | 'request-for-clarification'
    | 'maintenance-request'
    | 'referral-package'
    | 'records-request';
  state: string;
  stateTier: StateComplianceEntry['tier'];
  complianceBasis: string | null;
  disclaimerVersion: string;
  attorneyReviewDecision: AttorneyReviewDecision | null;
  generatedAt: string;

  /**
   * The analysis-layer gate at generation time. Null only where the artefact
   * involved no substantive analysis at all.
   */
  analysis: AnalysisAudit | null;
}

export interface AnalysisAudit {
  /** Whether a counsel-reviewed rule set governed. */
  readonly ruleSetStatus: 'available' | 'unavailable';
  /** Why not, when unavailable. Distinct reasons are kept distinct on purpose. */
  readonly unavailableReason: string | null;
  /** The review that governed, when one did. Recorded by value, not by lookup. */
  readonly reviewId: string | null;
  readonly reviewedOn: string | null;
  /** Which rule actually fired. */
  readonly ruleId: string | null;
  /**
   * What that rule CLAIMED — a reading of the document, or a proposition of
   * state law.
   *
   * This is the field that makes a partially-operating state answerable. Since
   * an unreviewed state runs its observation rules and not its doctrine rules,
   * "CA, unreviewed, and we still gave an answer" is only defensible if the
   * record can show the answer came from reading the instrument. Without this
   * the trail cannot distinguish that from a doctrine claim that leaked.
   */
  readonly ruleClaimType: RuleClaimType | null;
}

export function buildSendAuditRecord(input: {
  letterType: SendAuditRecord['letterType'];
  stateCompliance: StateComplianceEntry;
  attorneyReviewDecision?: AttorneyReviewDecision;
  /** The resolution that governed the substantive analysis, if any. */
  ruleSet?: RuleSetResolution;
  /** The rule that fired, and what it claimed. */
  firedRule?: { id: string; claimType: RuleClaimType };
  now?: Date;
}): SendAuditRecord {
  return {
    letterType: input.letterType,
    state: input.stateCompliance.state,
    stateTier: input.stateCompliance.tier,
    // Rendered from the structured bases rather than copied, and rendered
    // WITH the commerce mode that applied, because which statutes were
    // operative is the fact a later reader needs and it is not recoverable
    // from the citation alone. See regulatory-basis.ts.
    complianceBasis: basisSummary(input.stateCompliance.basis, COMMERCE_ENABLED),
    disclaimerVersion: CURRENT_DISCLAIMER.version,
    attorneyReviewDecision: input.attorneyReviewDecision ?? null,
    generatedAt: (input.now ?? new Date()).toISOString(),
    analysis: input.ruleSet === undefined ? null : buildAnalysisAudit(input.ruleSet, input.firedRule),
  };
}

function buildAnalysisAudit(
  resolution: RuleSetResolution,
  firedRule?: { id: string; claimType: RuleClaimType },
): AnalysisAudit {
  if (resolution.status === 'available') {
    return {
      ruleSetStatus: 'available',
      unavailableReason: null,
      // Copied, not referenced. A review that later expires must not change
      // what this record says governed at the time.
      reviewId: resolution.review.id,
      reviewedOn: resolution.review.reviewedOn,
      ruleId: firedRule?.id ?? null,
      ruleClaimType: firedRule?.claimType ?? null,
    };
  }
  return {
    ruleSetStatus: 'unavailable',
    unavailableReason: resolution.reason,
    reviewId: null,
    reviewedOn: null,
    ruleId: firedRule?.id ?? null,
    ruleClaimType: firedRule?.claimType ?? null,
  };
}
