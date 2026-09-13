import type { DurationDetermination } from '@/lib/analysis-layer';
import type { WizardFieldGateResult } from '@/lib/advocacy-wizard/gate-wizard-field';
import { buildAttorneyReviewStatusLine, type AttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import type { NormalizedAddress } from '@/lib/parcel-resolution';
import { type Letter, renderLetterAsPlainText } from './letter';

/**
 * Track 1 Maintenance Request Letter — CA-gated, paid feature. Unlike Track
 * 2's Request for Clarification, this letter asserts a position (that a
 * maintenance obligation exists under the easement), so per
 * docs/development-strategy-v2.md it may only draw on wizard fields that
 * cleared per-field gating (see gate-wizard-field.ts). A blocked field must
 * route the caller to Track 2 for that field instead — this function refuses
 * to draft around a flagged finding rather than silently omitting it.
 */

export class UnsupportedStateForTrackOneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedStateForTrackOneError';
  }
}

export class BlockedFieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BlockedFieldError';
  }
}

export class EmptyMaintenanceRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyMaintenanceRequestError';
  }
}

export interface MaintenanceRequestInput {
  /** Two-letter USPS state code. Phase 1 MVP only offers Track 1 for CA. */
  state: string;
  recipientName: string;
  senderName: string;
  propertyAddress: NormalizedAddress;
  durationGate: WizardFieldGateResult<DurationDetermination>;
  attorneyReviewDecision: AttorneyReviewDecision;
  /** Plain-language description of the requested maintenance, e.g. "clear vegetation encroaching on the utility easement." */
  maintenanceDescription: string;
  recordingReference?: string;
}

export type MaintenanceRequestLetter = Letter;

function formatAddress(address: NormalizedAddress): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

export function buildMaintenanceRequestLetter(input: MaintenanceRequestInput): MaintenanceRequestLetter {
  const state = input.state.trim().toUpperCase();
  if (state !== 'CA') {
    throw new UnsupportedStateForTrackOneError(
      `Track 1 (Advocacy Wizard) letters are only available for California in Phase 1 MVP; got "${state}".`,
    );
  }
  if (input.durationGate.status === 'blocked') {
    throw new BlockedFieldError(
      'Easement duration is flagged as ambiguous and cannot be asserted in a Maintenance ' +
        'Request Letter. Use the Request for Clarification (Track 2) letter for this field instead.',
    );
  }
  if (!input.recipientName.trim()) {
    throw new EmptyMaintenanceRequestError('recipientName is required');
  }
  if (!input.senderName.trim()) {
    throw new EmptyMaintenanceRequestError('senderName is required');
  }
  if (!input.maintenanceDescription.trim()) {
    throw new EmptyMaintenanceRequestError('maintenanceDescription is required');
  }

  const addressLine = formatAddress(input.propertyAddress);
  const subject = `Maintenance Request — Easement at ${addressLine}`;
  const salutation = `Dear ${input.recipientName.trim()},`;

  const referenceNote = input.recordingReference
    ? ` (recording reference: ${input.recordingReference})`
    : '';
  const caveatNote =
    input.durationGate.status === 'usable-with-caveat' ? ` (${input.durationGate.caveat})` : '';
  const introParagraph =
    `I am writing regarding the recorded easement affecting the property at ${addressLine}` +
    `${referenceNote}. ${input.durationGate.value.summary}${caveatNote}`;

  const requestParagraph =
    `Under the terms of this easement, I am requesting that you ${input.maintenanceDescription.trim()}. ` +
    'Please let me know a timeline for completing this work.';

  const closingParagraph =
    'I appreciate your prompt attention to this matter and look forward to your response.';

  const closing = `Sincerely,\n${input.senderName.trim()}`;

  const footerDisclaimer =
    [
      CURRENT_DISCLAIMER.notFromAttorneyText,
      CURRENT_DISCLAIMER.letterFooterText,
      CURRENT_DISCLAIMER.notLegalCounselText,
      buildAttorneyReviewStatusLine(input.attorneyReviewDecision),
    ].join(' ');

  return {
    subject,
    salutation,
    bodyParagraphs: [introParagraph, requestParagraph, closingParagraph],
    closing,
    footerDisclaimer,
  };
}

export { renderLetterAsPlainText };
