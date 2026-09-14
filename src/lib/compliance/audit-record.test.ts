import { stateTier } from '@/lib/gating/state-tier-config';
import { describe, expect, it } from 'vitest';
import type { StateComplianceEntry } from '@/lib/gating/state-tier-config';
import { buildSendAuditRecord } from './audit-record';
import { resolveAttorneyReviewDecision } from './attorney-review';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';

const caCompliance: StateComplianceEntry = {
  state: 'CA',
  tier: stateTier('A'),
  track1RequiredFlow: 'licensed-pathway',
  track2Available: true,
  basis: 'Legal Document Assistant statute',
  lastReviewedDate: null,
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
      complianceBasis: 'Legal Document Assistant statute',
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
