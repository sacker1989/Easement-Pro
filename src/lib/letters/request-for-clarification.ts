import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import type { NormalizedAddress } from '@/lib/parcel-resolution';
import { type Letter, renderLetterAsPlainText } from './letter';

/**
 * Track 2 Request for Clarification letter. Per docs/development-strategy-v2.md,
 * this is the lowest-risk letter in the product — it only asks a question, never
 * asserts a legal position — which is why it ships nationwide with no state
 * gating and no payment path, unlike Track 1's letters.
 */

export interface ClarificationPoint {
  topic: string;
  question: string;
  context?: string;
}

export interface RequestForClarificationInput {
  recipientName: string;
  senderName: string;
  propertyAddress: NormalizedAddress;
  clarificationPoints: ClarificationPoint[];
  /** Optional recording reference (instrument number, book/page) to cite for context. */
  recordingReference?: string;
}

export type RequestForClarificationLetter = Letter;

export class EmptyClarificationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyClarificationRequestError';
  }
}

/**
 * Maps any flagged or caveated confidence-tier result — from the Analysis
 * Layer's CA duration rule set, Track 3's data-coverage label, or any future
 * rule set built on the same generic engine — into a plain-language
 * clarification point. Returns null for a 'clear' result, since there's
 * nothing to ask about: this is the engineering counterpart to the UX
 * Agent's "Request for Clarification fallback offer when a needed field is
 * flagged."
 */
export function clarificationPointFromTieredResult(
  topic: string,
  result: TieredResult<unknown>,
): ClarificationPoint | null {
  if (result.tier === 'clear') {
    return null;
  }
  if (result.tier === 'likely-with-caveat') {
    return {
      topic,
      question:
        `Our review found a likely answer for "${topic}," but with an important caveat — ` +
        'could you confirm this is correct?',
      context: result.caveat,
    };
  }
  return {
    topic,
    question:
      `Our review could not confidently determine "${topic}" from the recorded document — ` +
      'could you help clarify this?',
    context: result.flagReason,
  };
}

function formatAddress(address: NormalizedAddress): string {
  return `${address.street}, ${address.city}, ${address.state} ${address.zip}`;
}

export function buildRequestForClarificationLetter(
  input: RequestForClarificationInput,
): RequestForClarificationLetter {
  if (!input.recipientName.trim()) {
    throw new EmptyClarificationRequestError('recipientName is required');
  }
  if (!input.senderName.trim()) {
    throw new EmptyClarificationRequestError('senderName is required');
  }
  if (input.clarificationPoints.length === 0) {
    throw new EmptyClarificationRequestError(
      'At least one clarification point is required — a letter with nothing to ask about ' +
        'is not a Request for Clarification.',
    );
  }

  const addressLine = formatAddress(input.propertyAddress);
  const subject = `Request for Clarification — Easement at ${addressLine}`;
  const salutation = `Dear ${input.recipientName.trim()},`;

  const referenceNote = input.recordingReference
    ? ` (recording reference: ${input.recordingReference})`
    : '';
  const introParagraph =
    `I am writing regarding the property at ${addressLine}${referenceNote}. While reviewing ` +
    'the recorded easement affecting this property, I identified a few points I would ' +
    'appreciate your help clarifying.';

  const pointParagraphs = input.clarificationPoints.map(
    (point, index) =>
      `${index + 1}. ${point.topic}: ${point.question}` + (point.context ? ` ${point.context}` : ''),
  );

  const closingParagraph =
    'Thank you for your time — I look forward to your response so we can both have a clear ' +
    'understanding of the easement terms.';

  const closing = `Sincerely,\n${input.senderName.trim()}`;

  const footerDisclaimer =
    `${CURRENT_DISCLAIMER.letterFooterText} This is a request for information only.`;

  return {
    subject,
    salutation,
    bodyParagraphs: [introParagraph, ...pointParagraphs, closingParagraph],
    closing,
    footerDisclaimer,
  };
}

export { renderLetterAsPlainText };
