import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { disclosureFor, fullLegalDisclosure, legalReviewDisclosure } from './legal-review-disclosure';
import { CA_RULE_SET } from '@/lib/analysis-layer/rule-sets/ca';
import type { RuleSetResolution } from '@/lib/analysis-layer/rule-set';
import { CURRENT_DISCLAIMER } from './disclaimer-copy';
import { registeredStates } from '@/lib/analysis-layer/registry';

describe('the disclosure is derived from the gate, not hardcoded', () => {
  it('shows for California, whose rule set exists and is unreviewed', () => {
    const d = legalReviewDisclosure('CA');
    expect(d.required).toBe(true);
    expect(d.text).toBe(CURRENT_DISCLAIMER.unreviewedLawText);
    expect(d.reason).toMatch(/never-reviewed/);
  });

  it('shows for a state with no rule set at all', () => {
    const d = legalReviewDisclosure('TX');
    expect(d.required).toBe(true);
    expect(d.reason).toMatch(/no-rule-set/);
  });

  it('shows for EVERY state today, which is the honest state', () => {
    // California has review: null; everything else has no entry. There is no
    // state where this is currently suppressed, and the suppression branch
    // exists so that stays visible rather than being assumed permanent.
    for (const s of [...registeredStates(), 'TX', 'FL', 'PA', 'NY']) {
      expect(legalReviewDisclosure(s).required).toBe(true);
    }
  });

  it('carries a machine-readable reason for the audit record', () => {
    // The copy is for the reader; the reason is for the trail. A letter sent
    // today must remain answerable about what was true when it went out.
    expect(legalReviewDisclosure('CA').reason.length).toBeGreaterThan(10);
    expect(legalReviewDisclosure('TX').reason).toContain('TX');
  });
});

describe('there is no way to switch it off', () => {
  it('takes a state code and nothing else', () => {
    // A disclosure with an off switch is a disclosure that gets switched off.
    expect(legalReviewDisclosure.length).toBe(1);
  });

  it('exposes no suppress or force parameter', () => {
    const src = readFileSync(new URL('./legal-review-disclosure.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/suppress|force|skipDisclosure|allowUnreviewed/i);
  });
});

describe('the copy names what actually differs between states', () => {
  it('is specific rather than generic boilerplate', () => {
    // "Consult an attorney" teaches nothing. Naming the four things that vary
    // tells a reader why it might matter to them.
    const t = CURRENT_DISCLAIMER.unreviewedLawText;
    expect(t).toMatch(/state law/i);
    expect(t).toMatch(/before it becomes\s+permanent/);
    expect(t).toMatch(/unrecorded easement binds/);
    expect(t).toMatch(/expires at all/);
  });

  it('says who assembled the rules, plainly', () => {
    expect(CURRENT_DISCLAIMER.unreviewedLawText).toMatch(
      /researchers\s+rather than lawyers/,
    );
  });

  it('tells the reader what to do with it', () => {
    expect(CURRENT_DISCLAIMER.unreviewedLawText).toMatch(/starting point for a conversation/);
  });
});

describe('the full block is ordered so a reader who stops early still learns the point', () => {
  it('leads with not-legal-counsel, then the unreviewed-law line', () => {
    const lines = fullLegalDisclosure('CA');
    expect(lines[0]).toBe(CURRENT_DISCLAIMER.notLegalCounselText);
    expect(lines[1]).toBe(CURRENT_DISCLAIMER.unreviewedLawText);
  });

  it('carries both lines today', () => {
    expect(fullLegalDisclosure('CA')).toHaveLength(2);
  });
});

describe('the suppression branch, exercised directly', () => {
  // It is unreachable through the registry — no state has a review, so a
  // mutation deleting this branch passed every test on first run. That is the
  // branch deciding whether a legal warning STOPS appearing, so it is the last
  // one that should go unchecked.
  const reviewed: RuleSetResolution = {
    status: 'available',
    ruleSet: { ...CA_RULE_SET, review: null },
    review: {
      id: 'rev-test-001',
      state: 'CA',
      reviewedBy: 'Test Counsel',
      barNumber: '000000',
      barJurisdiction: 'CA',
      reviewedOn: '2026-06-01',
      expiresOn: '2027-06-01',
      coversFields: ['recordingAct'],
      coversRuleOrder: true,
      reviewedSchemaVersion: 1,
      citationsDigest: 'cd_test',
    },
  };

  it('suppresses the warning when a review governs', () => {
    const d = disclosureFor(reviewed);
    expect(d.required).toBe(false);
    expect(d.text).toBeNull();
  });

  it('names the review record in the reason, so the trail survives', () => {
    expect(disclosureFor(reviewed).reason).toContain('rev-test-001');
  });

  it('still warns for any unavailable resolution', () => {
    const d = disclosureFor({
      status: 'unavailable',
      state: 'CA',
      reason: 'review-expired',
      explanation: 'expired',
    });
    expect(d.required).toBe(true);
    expect(d.text).toBe(CURRENT_DISCLAIMER.unreviewedLawText);
  });
});
