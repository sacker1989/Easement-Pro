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
  letterType: 'request-for-clarification' | 'maintenance-request';
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
