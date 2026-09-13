import { describe, expect, it } from 'vitest';
import { buildAdvocacyWizardState } from './build-advocacy-wizard-state';

const clearDuration = {
  easementType: 'appurtenant' as const,
  hasPerpetualLanguage: true,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

const ambiguousDuration = {
  easementType: 'unknown' as const,
  hasPerpetualLanguage: false,
  hasTermOrConditionSubsequent: false,
  documentLegible: true,
};

describe('buildAdvocacyWizardState', () => {
  it('keeps CA Track 1 available while blocking the duration field', () => {
    // The two gates, both firing, independently. CA is Tier A for UPL — the
    // product may prepare a document for a fee there — AND its easement rule
    // set has never been counsel-reviewed, so no substantive duration
    // conclusion may issue. Both facts are true at once, and this combination
    // is the one the previous code assumed away.
    const state = buildAdvocacyWizardState({ state: 'CA', duration: clearDuration });
    expect(state.access.available).toBe(true);
    expect(state.fields?.duration.status).toBe('blocked');
  });

  it('does not let a blocked analysis close off Track 1 entirely', () => {
    // Merging the two gates would take the whole wizard dark in CA, which is
    // the wrong failure: the licensing question and the substantive-law
    // question have different answers and different reviewers.
    const state = buildAdvocacyWizardState({ state: 'CA', duration: clearDuration });
    expect(state.access.available).toBe(true);
  });

  it('per-field-blocks an ambiguous duration without blocking the whole wizard', () => {
    const state = buildAdvocacyWizardState({ state: 'CA', duration: ambiguousDuration });
    expect(state.access.available).toBe(true);
    expect(state.fields?.duration.status).toBe('blocked');
    if (state.fields?.duration.status === 'blocked') {
      expect(state.fields.duration.clarificationOffer.topic).toBe('Easement duration');
    }
  });

  it('makes the wizard unavailable for a non-Tier-A state, with no fields to gate', () => {
    const state = buildAdvocacyWizardState({ state: 'TX', duration: clearDuration });
    expect(state.access.available).toBe(false);
    expect(state.fields).toBeNull();
  });
});
