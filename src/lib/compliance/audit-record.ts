import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';
import type { AttorneyReviewDecision } from './attorney-review';

/**
 * Structural audit-trail record: "linking every sent letter to the tier and
 * compliance basis active at generation time." This is an in-memory typed
 * shape for Phase 1 MVP — no persistence layer exists yet — designed so a
 * real store (Prisma/Postgres or otherwise) can serialize this record
 * directly once one is added, without reshaping the data.
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
}

export function buildSendAuditRecord(input: {
  letterType: SendAuditRecord['letterType'];
  stateCompliance: StateComplianceEntry;
  attorneyReviewDecision?: AttorneyReviewDecision;
  now?: Date;
}): SendAuditRecord {
  return {
    letterType: input.letterType,
    state: input.stateCompliance.state,
    stateTier: input.stateCompliance.tier,
    complianceBasis: input.stateCompliance.basis,
    disclaimerVersion: CURRENT_DISCLAIMER.version,
    attorneyReviewDecision: input.attorneyReviewDecision ?? null,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };
}
