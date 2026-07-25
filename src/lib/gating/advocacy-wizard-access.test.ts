import { describe, expect, it } from 'vitest';
import { evaluateAdvocacyWizardAccess } from './advocacy-wizard-access';
import { unclassifiedState, type StateComplianceEntry } from './state-tier-config';

const tierAEntry: StateComplianceEntry = {
  state: 'CA',
  tier: 'A',
  track1RequiredFlow: 'licensed-pathway',
  track2Available: true,
  basis: 'test fixture',
  lastReviewedDate: '2026-01-01',
};

const tierBEntry: StateComplianceEntry = {
  state: 'FL',
  tier: 'B',
  track1RequiredFlow: 'mandatory-review',
  track2Available: true,
  basis: 'test fixture',
  lastReviewedDate: '2026-01-01',
};

describe('evaluateAdvocacyWizardAccess', () => {
  it('makes the wizard available with a licensed-pathway flow for a Tier A state', () => {
    const decision = evaluateAdvocacyWizardAccess(tierAEntry);
    expect(decision.available).toBe(true);
    if (decision.available) {
      expect(decision.requiredFlow).toBe('licensed-pathway');
    }
  });

  it('makes the wizard available with a mandatory-review flow for a Tier B state', () => {
    const decision = evaluateAdvocacyWizardAccess(tierBEntry);
    expect(decision.available).toBe(true);
    if (decision.available) {
      expect(decision.requiredFlow).toBe('mandatory-review');
    }
  });

  it('makes the wizard unavailable for an unclassified state, with an honest boundary message', () => {
    const decision = evaluateAdvocacyWizardAccess(unclassifiedState('TX'));
    expect(decision.available).toBe(false);
    if (!decision.available) {
      expect(decision.message).toContain('TX');
      expect(decision.message).toContain('Request for Clarification');
      expect(decision.message).toContain('risk-disclosure');
    }
  });
});
