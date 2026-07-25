import { describe, expect, it } from 'vitest';
import { buildAttorneyReviewStatusLine, resolveAttorneyReviewDecision } from './attorney-review';

describe('resolveAttorneyReviewDecision', () => {
  it('forces mandatory-review to added/pending regardless of user choice', () => {
    const decision = resolveAttorneyReviewDecision('mandatory-review', 'declined');
    expect(decision).toEqual({ requiredFlow: 'mandatory-review', choice: 'added', status: 'pending' });
  });

  it('honors an explicit decline for licensed-pathway', () => {
    const decision = resolveAttorneyReviewDecision('licensed-pathway', 'declined');
    expect(decision).toEqual({ requiredFlow: 'licensed-pathway', choice: 'declined', status: 'not-required' });
  });

  it('honors an explicit add for licensed-pathway', () => {
    const decision = resolveAttorneyReviewDecision('licensed-pathway', 'added');
    expect(decision).toEqual({ requiredFlow: 'licensed-pathway', choice: 'added', status: 'pending' });
  });

  it('defaults an unanswered licensed-pathway choice to declined/not-required', () => {
    const decision = resolveAttorneyReviewDecision('licensed-pathway');
    expect(decision.choice).toBe('declined');
    expect(decision.status).toBe('not-required');
  });
});

describe('buildAttorneyReviewStatusLine', () => {
  it('describes mandatory review', () => {
    const line = buildAttorneyReviewStatusLine(resolveAttorneyReviewDecision('mandatory-review'));
    expect(line).toContain('mandatory review required');
  });

  it('describes a pending opt-in review', () => {
    const line = buildAttorneyReviewStatusLine(resolveAttorneyReviewDecision('licensed-pathway', 'added'));
    expect(line).toContain('pending');
  });

  it('describes a declined review without shaming language', () => {
    const line = buildAttorneyReviewStatusLine(resolveAttorneyReviewDecision('licensed-pathway', 'declined'));
    expect(line).toContain("sender's choice");
  });
});
