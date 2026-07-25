import { describe, expect, it } from 'vitest';
import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import type { DurationDetermination } from '@/lib/analysis-layer';
import { gateWizardField } from '@/lib/advocacy-wizard/gate-wizard-field';
import { resolveAttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { normalizeAddress } from '@/lib/parcel-resolution';
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

  it('rejects any state other than CA', () => {
    expect(() => buildMaintenanceRequestLetter({ ...validInput, state: 'TX' })).toThrow(
      UnsupportedStateForTrackOneError,
    );
  });

  it('rejects an empty maintenance description', () => {
    expect(() =>
      buildMaintenanceRequestLetter({ ...validInput, maintenanceDescription: '  ' }),
    ).toThrow(EmptyMaintenanceRequestError);
  });

  it('includes a footer disclaimer', () => {
    const letter = buildMaintenanceRequestLetter(validInput);
    expect(letter.footerDisclaimer).toContain('not a substitute for legal advice');
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
