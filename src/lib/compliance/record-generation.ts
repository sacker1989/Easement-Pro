/**
 * The one call a send flow makes to leave a trail.
 *
 * WHY "GENERATION" AND NOT "SEND". This product never transmits anything — the
 * homeowner sends their own letter, which is the whole authorship position in
 * disclaimer v2. So the auditable moment is the one where an artefact came into
 * existence bearing a tier, a disclaimer version and an analysis basis. That is
 * what `SendAuditRecord` already meant by "active at generation time"; this
 * names it consistently.
 *
 * WHY A HELPER RATHER THAN CALLING recordSend DIRECTLY. Three flows generate
 * letters and each would otherwise assemble the record itself, which is how one
 * of them ends up omitting the analysis block or passing a stale resolution.
 * One entry point means one place to change when the record grows again.
 *
 * FAILURE IS RETURNED, NOT THROWN. A page that cannot write an audit record
 * must not hand the user a letter as though nothing happened, and must also not
 * show them a stack trace. The caller gets a result it can render, and the
 * decision about what to do with an unrecordable artefact stays in the flow
 * that knows what it was about to produce.
 *
 * WHAT A RECORD MEANS, PRECISELY: "an artefact was ABOUT TO BE PRODUCED under
 * this basis", not "an artefact was delivered". Because the record is written
 * first, a later failure — Stripe unconfigured, a renderer throwing — leaves a
 * record for a letter that never reached anyone.
 *
 * That over-recording is deliberate and is the safe direction. The question
 * this trail must answer is "on what basis did you prepare something for this
 * person", and a spurious row is answerable while a missing one is not. Writing
 * afterwards would invert it: every failure between generation and logging
 * would produce a delivered artefact with no record, which is the exact gap the
 * control exists to close. If delivery itself ever needs auditing, that is a
 * SECOND record appended later, not a reordering of this one.
 */

import { buildSendAuditRecord, type SendAuditRecord } from './audit-record';
import { recordSend, AuditStoreError } from './audit-store';
import { resolveAuditStore } from './audit-store-config';
import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import type { AttorneyReviewDecision } from './attorney-review';
import type { RuleSetResolution } from '@/lib/analysis-layer/rule-set';
import type { RuleClaimType } from '@/lib/analysis-layer/confidence-tiering';

export interface GenerationAudit {
  letterType: SendAuditRecord['letterType'];
  stateCompliance: StateComplianceEntry;
  attorneyReviewDecision?: AttorneyReviewDecision;
  ruleSet?: RuleSetResolution;
  firedRule?: { id: string; claimType: RuleClaimType };
  now?: Date;
}

export type GenerationAuditResult =
  | { readonly ok: true; readonly record: SendAuditRecord; readonly warning: string | null }
  | { readonly ok: false; readonly reason: string };

/**
 * Writes the record for a generated artefact.
 *
 * Returns `ok: false` rather than throwing, so a route can decide whether to
 * withhold the artefact. It does NOT decide that itself — withholding a free
 * Track 3 report because a log is misconfigured would be the wrong trade, and
 * withholding a paid Track 1 letter is the right one. Only the flow knows
 * which it is.
 */
export async function recordGeneration(input: GenerationAudit): Promise<GenerationAuditResult> {
  const config = resolveAuditStore();
  const record = buildSendAuditRecord(input);

  try {
    await recordSend(config.store, record);
    return { ok: true, record, warning: config.warning };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof AuditStoreError
          ? err.message
          : `Audit record could not be written: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}

/**
 * Copy for a flow that had to withhold an artefact.
 *
 * Written for the person reading the screen rather than the operator. They did
 * nothing wrong, the fault is ours, and the sentence says so without
 * pretending the artefact is coming.
 */
export const AUDIT_BLOCKED_MESSAGE =
  'This letter was not generated. Before preparing a letter, this service records what legal and ' +
  'compliance basis it was prepared under, so that it stays answerable later — and that record ' +
  'could not be written just now. That is a fault on our side, not anything to do with your ' +
  'property. Nothing was charged and nothing was sent.';
