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
  it('makes the wizard available for CA with a usable duration field', () => {
    const state = buildAdvocacyWizardState({ state: 'CA', duration: clearDuration });
    expect(state.access.available).toBe(true);
    expect(state.fields?.duration.status).toBe('usable');
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
