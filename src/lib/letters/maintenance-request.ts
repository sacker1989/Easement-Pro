import type { DurationDetermination } from '@/lib/analysis-layer';
import type { WizardFieldGateResult } from '@/lib/advocacy-wizard/gate-wizard-field';
import { buildAttorneyReviewStatusLine, type AttorneyReviewDecision } from '@/lib/compliance/attorney-review';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import { evaluateAdvocacyWizardAccess } from '@/lib/gating/advocacy-wizard-access';
import { getStateCompliance } from '@/config/state-tiers';
import type { NormalizedAddress } from '@/lib/parcel-resolution';
import { type Letter, renderLetterAsPlainText } from './letter';

/**
 * Track 1 Maintenance Request Letter. Unlike Track 2's Request for
 * Clarification, this letter asserts a position (that a maintenance obligation
 * exists under the easement), so per docs/development-strategy-v2.md it may
 * only draw on wizard fields that cleared per-field gating (see
 * gate-wizard-field.ts). A blocked field must route the caller to Track 2 for
 * that field instead — this function refuses to draft around a flagged finding
 * rather than silently omitting it.
 *
 * NO LONGER A PAID FEATURE. Free mode, 2026-10-04. The word "paid" stood in
 * this header for two months after the pivot, which is the small version of
 * the larger problem Phase 4 is clearing up: the compliance layer kept
 * describing a product that had changed underneath it.
 *
 * NO LONGER CA-HARDCODED EITHER, and that is the substantive change. This
 * function used to refuse any state but California with a literal
 * `state !== 'CA'`. The matrix in src/config/state-tiers.ts already encoded
 * exactly that, so the hardcode was a second source of truth that happened to
 * agree — and the failure mode of a second source of truth is that adding a
 * state to the matrix silently does nothing. BEHAVIOUR IS UNCHANGED TODAY:
 * California is still the only entry, so the same states are refused. What
 * changed is that adding the next one is a data edit.
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
  // The matrix decides, not this file. An UNCLASSIFIED state and a Tier C
  // state both land here, and they gate identically on purpose while staying
  // distinct in the entry — "never reviewed" and "reviewed and refused" are
  // different statements about the world even when they produce the same
  // refusal. The message carries the entry's own wording so the user is told
  // which one applies to them.
  const access = evaluateAdvocacyWizardAccess(getStateCompliance(state));
  if (!access.available) {
    throw new UnsupportedStateForTrackOneError(
      `Track 1 (Advocacy Wizard) letters are not available in ${state}. ${access.message}`,
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
