import { stateTier } from '@/lib/gating/state-tier-config';
import { describe, expect, it } from 'vitest';
import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import { buildSendAuditRecord } from './audit-record';
import { FIXTURE_BASES } from '@/lib/test-support/regulatory-basis-fixture';
import { resolveAttorneyReviewDecision } from './attorney-review';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';

const caCompliance: StateComplianceEntry = {
  state: 'CA',
  tier: stateTier('A'),
  track1RequiredFlow: 'licensed-pathway',
  track2Available: true,
  basis: FIXTURE_BASES,
  uplReview: null,
};

describe('buildSendAuditRecord', () => {
  it('captures the tier, basis, and disclaimer version active at generation time', () => {
    const record = buildSendAuditRecord({
      letterType: 'maintenance-request',
      stateCompliance: caCompliance,
      attorneyReviewDecision: resolveAttorneyReviewDecision('licensed-pathway', 'declined'),
      now: new Date('2026-01-15T12:00:00Z'),
    });
    expect(record).toEqual({
      letterType: 'maintenance-request',
      state: 'CA',
      stateTier: 'A',
      complianceBasis:
        'Test Code §1 (fixture) [document-assistant; not operative (compensation is an element and ' +
        'this product is free)]; Test Code §2 (fixture) [unauthorized-practice; operative]',
      // The fixture entry is Tier A with no review and state 'CA', so the gate
      // finds the recorded acceptance and the record says so — naming the
      // refusal it overrode rather than just "accepted".
      uplAuthorisation: {
        basis: 'accepted-risk:never-reviewed',
        reviewId: null,
        acceptedUnderGapId: 'LASTREVIEWEDDATE-NOT-ENFORCED',
      },
      disclaimerVersion: CURRENT_DISCLAIMER.version,
      attorneyReviewDecision: { requiredFlow: 'licensed-pathway', choice: 'declined', status: 'not-required' },
      generatedAt: '2026-01-15T12:00:00.000Z',
      // Null when no rule set was passed. The analysis half is optional
      // because not every artefact involves substantive analysis — a records
      // request does not — and a required-but-meaningless field would be
      // filled with something untrue.
      analysis: null,
    });
  });

  it('defaults attorneyReviewDecision to null for Track 2 (no review flow)', () => {
    const record = buildSendAuditRecord({
      letterType: 'request-for-clarification',
      stateCompliance: caCompliance,
    });
    expect(record.attorneyReviewDecision).toBeNull();
  });
});
