import { describe, expect, it } from 'vitest';
import { getStateCompliance } from '@/config/state-tiers';
import { codeOf } from '@/lib/test-support/source-text';
import {
  NO_SCOPE,
  permits,
  resolveUplAuthorisation,
  UPL_REVIEW_MAX_AGE_MONTHS,
  type UplReviewRecord,
} from './upl-review';

const TODAY = '2026-10-05';

const review: UplReviewRecord = {
  id: 'upl-ca-001',
  state: 'CA',
  reviewedBy: 'Fixture Counsel',
  barNumber: '000000',
  barJurisdiction: 'CA',
  reviewedOn: '2026-09-01',
  expiresOn: '2028-09-01',
  scope: {
    reportsPublicRecords: true,
    openEndedResearch: true,
    advice: true,
    positionAssertingLetters: false,
  },
  coversBases: ['Cal. Bus. & Prof. Code §6125'],
};

describe('resolveUplAuthorisation', () => {
  it('authorises a current review from an attorney admitted in that state', () => {
    const auth = resolveUplAuthorisation('CA', review, TODAY);
    expect(auth.status).toBe('authorised');
    expect(auth.scope.advice).toBe(true);
    expect(permits(auth, 'openEndedResearch')).toBe(true);
    // Scope is per-activity. An opinion approving research and advice says
    // nothing about correspondence that asserts a position.
    expect(permits(auth, 'positionAssertingLetters')).toBe(false);
  });

  it('refuses when no review exists, and says free mode did not answer it', () => {
    const auth = resolveUplAuthorisation('CA', null, TODAY);
    expect(auth.status).toBe('refused');
    if (auth.status !== 'refused') return;
    expect(auth.reason).toBe('never-reviewed');
    // The sentence that stops someone concluding free mode closed this.
    expect(auth.explanation).toMatch(/no compensation element/i);
    expect(auth.scope).toEqual(NO_SCOPE);
  });

  it("refuses another state's attorney", () => {
    const auth = resolveUplAuthorisation('NV', { ...review, state: 'NV' }, TODAY);
    expect(auth.status).toBe('refused');
    if (auth.status !== 'refused') return;
    expect(auth.reason).toBe('bar-jurisdiction-mismatch');
  });

  it('refuses an expired review outright rather than narrowing it', () => {
    // A lapsed opinion is not a more cautious opinion. If this ever returned a
    // reduced scope instead of NO_SCOPE, an expired review would quietly keep
    // authorising the safest activities forever.
    const auth = resolveUplAuthorisation('CA', { ...review, expiresOn: '2026-01-01' }, TODAY);
    expect(auth.status).toBe('refused');
    if (auth.status !== 'refused') return;
    expect(auth.reason).toBe('review-expired');
    expect(auth.scope).toEqual(NO_SCOPE);
  });

  it('applies the age ceiling even when the entry sets a longer expiry', () => {
    const old = {
      ...review,
      reviewedOn: '2023-01-01',
      expiresOn: '2099-01-01',
    };
    const auth = resolveUplAuthorisation('CA', old, TODAY);
    expect(auth.status).toBe('refused');
    if (auth.status !== 'refused') return;
    expect(auth.reason).toBe('review-expired');
    expect(auth.explanation).toContain(String(UPL_REVIEW_MAX_AGE_MONTHS));
  });

  it('takes no override parameter', () => {
    // Same arity discipline as resolveStateRuleSet. A gate with a bypass is a
    // gate that gets bypassed — first in a fixture, then in a demo.
    expect(resolveUplAuthorisation.length).toBe(3);
    const code = codeOf(new URL('./upl-review.ts', import.meta.url));
    expect(code).not.toMatch(/allowUnreviewed|skipReview|force\s*:/);
  });
});

describe("California's recorded direction", () => {
  const ca = getStateCompliance('CA');

  it('records what the owner says counsel allows', () => {
    expect(ca.uplDirection).toBeDefined();
    expect(ca.uplDirection!.expectedScope.openEndedResearch).toBe(true);
    expect(ca.uplDirection!.expectedScope.advice).toBe(true);
  });

  it('does not extend the direction to position-asserting letters', () => {
    // THE ASSERTION MOST WORTH KEEPING. The direction named research and
    // advice — statements made TO the user. A Track 1 letter is an act
    // performed on their behalf and sent to a third party, and reading it in
    // from the other two would widen the scope beyond what was said, in the
    // direction that cannot be taken back once a letter is in the post.
    expect(ca.uplDirection!.expectedScope.positionAssertingLetters).toBe(false);
  });

  it('is not a review, and cannot become one by being detailed', () => {
    expect(ca.uplReview).toBeNull();
    const auth = resolveUplAuthorisation('CA', ca.uplReview, TODAY);
    expect(auth.status).toBe('refused');
    expect(auth.scope).toEqual(NO_SCOPE);
  });

  it('names exactly what is missing, so filling it in is a data edit', () => {
    const missing = ca.uplDirection!.missing;
    expect(missing.length).toBe(4);
    expect(missing.join(' ')).toMatch(/bar number/i);
  });

  it('quotes the direction verbatim rather than paraphrasing it', () => {
    // A paraphrase of what someone said about legal scope is how the scope
    // drifts. The words are kept.
    expect(ca.uplDirection!.statedAs).toContain('open ended research and advice');
    expect(ca.uplDirection!.statedAs).toContain('2026-10-05');
  });
});
