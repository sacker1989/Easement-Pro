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
  it('lets a document-derived CA finding through while CA is unreviewed', () => {
    // The observation/doctrine split. `clearDuration` comes from
    // ca-express-perpetual, which reads the instrument rather than applying
    // California doctrine, so it survives the review gate and the wizard field
    // is usable. This is what partial operation in an unreviewed state buys.
    const state = buildAdvocacyWizardState({ state: 'CA', duration: clearDuration });
    expect(state.access.available).toBe(true);
    expect(state.fields?.duration.status).toBe('usable');
  });

  it('blocks the field when the finding depends on doctrine', () => {
    // The flagged result an unreviewed state produces for a doctrine question
    // still blocks, which is the half of the gate that must not move.
    const state = buildAdvocacyWizardState({
      state: 'CA',
      duration: {
        easementType: 'appurtenant',
        hasPerpetualLanguage: false,
        hasTermOrConditionSubsequent: false,
        documentLegible: true,
      },
    });
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
