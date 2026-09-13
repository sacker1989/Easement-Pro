import { describe, expect, it } from 'vitest';
import { CURRENT_DISCLAIMER } from '@/lib/compliance/disclaimer-copy';
import type { TieredResult } from '@/lib/analysis-layer/confidence-tiering';
import { normalizeAddress } from '@/lib/parcel-resolution';
import {
  buildRequestForClarificationLetter,
  clarificationPointFromTieredResult,
  EmptyClarificationRequestError,
  renderLetterAsPlainText,
} from './request-for-clarification';

const propertyAddress = normalizeAddress({
  street: '100 Main St',
  city: 'Beverly Hills',
  state: 'CA',
  zip: '90210',
});

describe('clarificationPointFromTieredResult', () => {
  it('returns null for a clear result', () => {
    const result: TieredResult<string> = { tier: 'clear', ruleId: 'r1', value: 'ok' };
    expect(clarificationPointFromTieredResult('Easement duration', result)).toBeNull();
  });

  it('builds a point with the caveat as context for likely-with-caveat', () => {
    const result: TieredResult<string> = {
      tier: 'likely-with-caveat',
      ruleId: 'r2',
      value: 'ok',
      caveat: 'this is a default presumption',
    };
    const point = clarificationPointFromTieredResult('Easement duration', result);
    expect(point).toMatchObject({ topic: 'Easement duration', context: 'this is a default presumption' });
    expect(point?.question).toContain('likely answer');
  });

  it('builds a point with the flagReason as context for flagged-ambiguous', () => {
    const result: TieredResult<string> = {
      tier: 'flagged-ambiguous',
      ruleId: 'r3',
      flagReason: 'conflicting clauses',
    };
    const point = clarificationPointFromTieredResult('Easement duration', result);
    expect(point).toMatchObject({ topic: 'Easement duration', context: 'conflicting clauses' });
    expect(point?.question).toContain('could not confidently determine');
  });
});

describe('buildRequestForClarificationLetter', () => {
  const validInput = {
    recipientName: 'Jane Neighbor',
    senderName: 'John Homeowner',
    propertyAddress,
    clarificationPoints: [{ topic: 'Easement duration', question: 'Is this perpetual?', context: 'unclear from the document' }],
  };

  it('produces a subject line naming the property address', () => {
    const letter = buildRequestForClarificationLetter(validInput);
    expect(letter.subject).toContain('100 Main St, Beverly Hills, CA 90210');
  });

  it('numbers each clarification point in the body', () => {
    const letter = buildRequestForClarificationLetter({
      ...validInput,
      clarificationPoints: [
        { topic: 'Duration', question: 'Q1?' },
        { topic: 'Scope', question: 'Q2?' },
      ],
    });
    expect(letter.bodyParagraphs.some((p) => p.startsWith('1. Duration'))).toBe(true);
    expect(letter.bodyParagraphs.some((p) => p.startsWith('2. Scope'))).toBe(true);
  });

  it('includes a recording reference when supplied', () => {
    const letter = buildRequestForClarificationLetter({ ...validInput, recordingReference: '1958-12345' });
    expect(letter.bodyParagraphs[0]).toContain('1958-12345');
  });

  it('includes a placeholder disclaimer footer', () => {
    const letter = buildRequestForClarificationLetter(validInput);
    // Asserted against the CONSTANT, not a hardcoded phrase. Hardcoding one
    // defeats the single-source-of-truth this module exists to be: the copy
    // changed in v2 and these were the only two places that noticed, for the
    // wrong reason.
    expect(letter.footerDisclaimer).toContain(CURRENT_DISCLAIMER.letterFooterText);
    expect(letter.footerDisclaimer).toMatch(/not legal advice/);
  });

  it('rejects an empty recipient name', () => {
    expect(() => buildRequestForClarificationLetter({ ...validInput, recipientName: '  ' })).toThrow(
      EmptyClarificationRequestError,
    );
  });

  it('rejects an empty sender name', () => {
    expect(() => buildRequestForClarificationLetter({ ...validInput, senderName: '' })).toThrow(
      EmptyClarificationRequestError,
    );
  });

  it('rejects zero clarification points', () => {
    expect(() => buildRequestForClarificationLetter({ ...validInput, clarificationPoints: [] })).toThrow(
      EmptyClarificationRequestError,
    );
  });
});

describe('renderLetterAsPlainText', () => {
  it('renders subject, salutation, body, closing, and footer in order', () => {
    const letter = buildRequestForClarificationLetter({
      recipientName: 'Jane Neighbor',
      senderName: 'John Homeowner',
      propertyAddress,
      clarificationPoints: [{ topic: 'Duration', question: 'Is this perpetual?' }],
    });
    const text = renderLetterAsPlainText(letter);
    const subjectIndex = text.indexOf('Subject:');
    const salutationIndex = text.indexOf('Dear Jane Neighbor');
    const closingIndex = text.indexOf('Sincerely');
    const footerIndex = text.indexOf('request for information only');
    expect(subjectIndex).toBeGreaterThanOrEqual(0);
    expect(salutationIndex).toBeGreaterThan(subjectIndex);
    expect(closingIndex).toBeGreaterThan(salutationIndex);
    expect(footerIndex).toBeGreaterThan(closingIndex);
  });
});
