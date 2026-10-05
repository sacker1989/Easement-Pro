import { describe, expect, it } from 'vitest';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import type { DurationDetermination } from '@/lib/analysis-layer';
import { gateWizardField } from '@/lib/advocacy-wizard/gate-wizard-field';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { normalizeAddress } from '@/lib/parcel-resolution';
import { getStateCompliance, STATE_COMPLIANCE_MATRIX } from '@/config/state-tiers';
import { evaluateAdvocacyWizardAccess } from '@/lib/gating/advocacy-wizard-access';
import { codeOf } from '@/lib/test-support/source-text';
import {
  BlockedFieldError,
  buildMaintenanceRequestLetter,
  EmptyMaintenanceRequestError,
  UnsupportedStateForTrackOneError,
} from './maintenance-request';

const propertyAddress = normalizeAddress({
  street: '100 Main St',
  city: 'Beverly Hills',
  state: 'CA',
  zip: '90210',
});

const clearDurationResult: TieredResult<DurationDetermination> = {
  tier: 'clear',
  ruleId: 'ca-express-perpetual',
  value: { basis: 'perpetual-express', summary: 'The easement is expressly perpetual.' },
};
const usableDurationGate = gateWizardField<DurationDetermination>('Easement duration', clearDurationResult);

const caveatedDurationResult: TieredResult<DurationDetermination> = {
  tier: 'likely-with-caveat',
  ruleId: 'ca-appurtenant-default-presumption',
  value: { basis: 'perpetual-appurtenant-default', summary: 'Presumed perpetual absent contrary language.' },
  caveat: 'this is a default presumption',
};
const caveatedDurationGate = gateWizardField<DurationDetermination>('Easement duration', caveatedDurationResult);

const blockedDurationResult: TieredResult<DurationDetermination> = {
  tier: 'flagged-ambiguous',
  ruleId: 'ca-unknown-easement-type',
  flagReason: 'easement type unknown',
};
const blockedDurationGate = gateWizardField<DurationDetermination>('Easement duration', blockedDurationResult);

const validInput = {
  state: 'CA',
  recipientName: 'Acme Utility Co.',
  senderName: 'John Homeowner',
  propertyAddress,
  durationGate: usableDurationGate,
  attorneyReviewDecision: resolveAttorneyReviewDecision('licensed-pathway', 'declined'),
  maintenanceDescription: 'clear vegetation encroaching on the utility easement',
};

describe('buildMaintenanceRequestLetter', () => {
  it('includes the duration summary when the field is usable', () => {
    const letter = buildMaintenanceRequestLetter(validInput);
    expect(letter.bodyParagraphs[0]).toContain('The easement is expressly perpetual.');
  });

  it('includes the caveat parenthetically when the field is usable-with-caveat', () => {
    const letter = buildMaintenanceRequestLetter({ ...validInput, durationGate: caveatedDurationGate });
    expect(letter.bodyParagraphs[0]).toContain('Presumed perpetual absent contrary language.');
    expect(letter.bodyParagraphs[0]).toContain('this is a default presumption');
  });

  it('rejects a blocked duration field rather than drafting around it', () => {
    expect(() =>
      buildMaintenanceRequestLetter({ ...validInput, durationGate: blockedDurationGate }),
    ).toThrow(BlockedFieldError);
  });

  it('rejects a state the compliance matrix does not enable', () => {
    expect(() => buildMaintenanceRequestLetter({ ...validInput, state: 'TX' })).toThrow(
      UnsupportedStateForTrackOneError,
    );
  });

  describe('the gate is the matrix, not a literal in this file', () => {
    it('refuses every state the matrix leaves unclassified', () => {
      // Not a sample of one. A hardcode that happened to agree with the matrix
      // for California would pass a single TX case and fail the day a second
      // state was added to the matrix and silently did nothing.
      for (const state of ['TX', 'FL', 'NY', 'WY', 'ZZ']) {
        expect(
          evaluateAdvocacyWizardAccess(getStateCompliance(state)).available,
          `${state} should not be Track 1 enabled`,
        ).toBe(false);
        expect(() => buildMaintenanceRequestLetter({ ...validInput, state })).toThrow(
          UnsupportedStateForTrackOneError,
        );
      }
    });

    it('allows exactly the states the matrix enables', () => {
      // Derived from the matrix rather than written out, so adding a Track 1
      // state updates both sides of this at once. If a state is enabled and
      // the builder still refuses it, the hardcode has come back.
      const enabled = Object.keys(STATE_COMPLIANCE_MATRIX).filter(
        (s) => evaluateAdvocacyWizardAccess(getStateCompliance(s)).available,
      );
      expect(enabled.length).toBeGreaterThan(0);
      for (const state of enabled) {
        expect(() =>
          buildMaintenanceRequestLetter({ ...validInput, state }),
        ).not.toThrow();
      }
    });

    it('carries no state literal in the source', () => {
      // The specific regression: `if (state !== 'CA') throw`. A second source
      // of truth that agrees today is still a second source of truth, and its
      // failure mode is silence. Comments are stripped — this file's own
      // prose discusses the removed hardcode.
      const code = codeOf(new URL('./maintenance-request.ts', import.meta.url));
      expect(code).not.toMatch(/state\s*!==\s*['"]CA['"]/);
      expect(code).toContain('evaluateAdvocacyWizardAccess');
    });
  });

  it('rejects an empty maintenance description', () => {
    expect(() =>
      buildMaintenanceRequestLetter({ ...validInput, maintenanceDescription: '  ' }),
    ).toThrow(EmptyMaintenanceRequestError);
  });

  it('includes a footer disclaimer', () => {
    const letter = buildMaintenanceRequestLetter(validInput);
    // Asserted against the CONSTANT, not a hardcoded phrase. Hardcoding one
    // defeats the single-source-of-truth this module exists to be: the copy
    // changed in v2 and these were the only two places that noticed, for the
    // wrong reason.
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.letterFooterText);
    expect(letter.footerDisclaimer).toMatch(/not legal advice/);
  });

  it('includes the attorney-review status line in the footer', () => {
    const declined = buildMaintenanceRequestLetter(validInput);
    expect(declined.footerDisclaimer).toContain("sender's choice");

    const withReview = buildMaintenanceRequestLetter({
      ...validInput,
      attorneyReviewDecision: resolveAttorneyReviewDecision('mandatory-review'),
    });
    expect(withReview.footerDisclaimer).toContain('mandatory review required');
  });
});
