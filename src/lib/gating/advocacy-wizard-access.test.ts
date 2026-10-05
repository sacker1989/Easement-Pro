import { describe, expect, it } from 'vitest';
import { FIXTURE_BASES } from '@/lib/test-support/regulatory-basis-fixture';
import { getStateCompliance } from '@/config/state-tiers';
import { stateTier } from '@/lib/gating/state-tier-config';
import { evaluateAdvocacyWizardAccess } from './advocacy-wizard-access';
import { unclassifiedState, type StateComplianceEntry } from './state-tier-config';
import type { UplReviewRecord } from './upl-review';

const TODAY = '2026-10-05';

const reviewedCa: UplReviewRecord = {
  id: 'upl-ca-fixture',
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
    positionAssertingLetters: true,
  },
  coversBases: ['Cal. Bus. & Prof. Code §6125'],
};

const tierAEntry: StateComplianceEntry = {
  state: 'CA',
  tier: stateTier('A'),
  track1RequiredFlow: 'licensed-pathway',
  track2Available: true,
  basis: FIXTURE_BASES,
  uplReview: null,
};

const tierBEntry: StateComplianceEntry = {
  state: 'FL',
  tier: stateTier('B'),
  track1RequiredFlow: 'mandatory-review',
  track2Available: true,
  basis: FIXTURE_BASES,
  uplReview: null,
};

describe('evaluateAdvocacyWizardAccess', () => {
  it('makes the wizard available with a licensed-pathway flow for a reviewed Tier A state', () => {
    const decision = evaluateAdvocacyWizardAccess(
      { ...tierAEntry, uplReview: reviewedCa },
      TODAY,
    );
    expect(decision.available).toBe(true);
    if (!decision.available) return;
    expect(decision.requiredFlow).toBe('licensed-pathway');
    expect(decision.operatingUnderAcceptedRisk).toBe(false);
    expect(decision.scope.advice).toBe(true);
  });

  it('makes the wizard unavailable for an unclassified state, with an honest boundary message', () => {
    const decision = evaluateAdvocacyWizardAccess(unclassifiedState('TX'), TODAY);
    expect(decision.available).toBe(false);
    if (decision.available) return;
    expect(decision.message).toContain('TX');
    expect(decision.message).toContain('Request for Clarification');
    expect(decision.message).toContain('risk-disclosure');
  });

  describe('the review is actually consulted now', () => {
    it('refuses a Tier B state with no review and no recorded acceptance', () => {
      // CHANGED BEHAVIOUR, AND IT IS THE POINT. This fixture used to be
      // available purely because the gate branched on track1RequiredFlow and
      // never looked at the review. Florida has no review and no acceptance,
      // so Track 1 is refused there — which is what a Tier B state with no
      // counsel opinion should get.
      const decision = evaluateAdvocacyWizardAccess(tierBEntry, TODAY);
      expect(decision.available).toBe(false);
      expect(decision.upl.status).toBe('refused');
      if (decision.upl.status !== 'refused') return;
      expect(decision.upl.reason).toBe('never-reviewed');
    });

    it('refuses an expired review rather than treating it as a narrower one', () => {
      const expired = { ...reviewedCa, expiresOn: '2026-01-01' };
      const decision = evaluateAdvocacyWizardAccess(
        { ...tierAEntry, state: 'ZZ', uplReview: { ...expired, state: 'ZZ', barJurisdiction: 'ZZ' } },
        TODAY,
      );
      expect(decision.available).toBe(false);
      if (decision.upl.status !== 'refused') throw new Error('expected refused');
      expect(decision.upl.reason).toBe('review-expired');
      expect(decision.scope.advice).toBe(false);
    });

    it("refuses another state's attorney", () => {
      const decision = evaluateAdvocacyWizardAccess(
        { ...tierAEntry, state: 'NV', uplReview: { ...reviewedCa, state: 'NV' } },
        TODAY,
      );
      expect(decision.available).toBe(false);
      if (decision.upl.status !== 'refused') throw new Error('expected refused');
      expect(decision.upl.reason).toBe('bar-jurisdiction-mismatch');
    });
  });

  describe('California, which stays available without a review', () => {
    const ca = getStateCompliance('CA');

    it('has no review on file', () => {
      expect(ca.uplReview).toBeNull();
    });

    it('stays available, and says plainly that it is running on an accepted risk', () => {
      const decision = evaluateAdvocacyWizardAccess(ca, TODAY);
      expect(decision.available).toBe(true);
      if (!decision.available) return;
      expect(decision.operatingUnderAcceptedRisk).toBe(true);
      expect(decision.acceptedUnderGapId).toBe('LASTREVIEWEDDATE-NOT-ENFORCED');
      // The review WAS consulted and WAS refused. That is the difference
      // between this and the previous implementation, which never looked.
      expect(decision.upl.status).toBe('refused');
    });

    it('grants no scope on the strength of an acceptance', () => {
      // An acceptance is a decision to keep a feature running. It is not an
      // opinion and cannot widen what the product may do — otherwise accepting
      // a risk would become a way to authorise oneself.
      const decision = evaluateAdvocacyWizardAccess(ca, TODAY);
      if (!decision.available) throw new Error('expected available');
      expect(decision.scope).toEqual({
        reportsPublicRecords: false,
        openEndedResearch: false,
        advice: false,
        positionAssertingLetters: false,
      });
    });

    it('records the owner direction without letting it authorise anything', () => {
      // The 2026-10-05 direction says counsel allows open-ended research and
      // advice. It is recorded, and the gate grants neither, because a
      // direction is not an opinion. If this ever fails, the expected scope has
      // been wired into the gate and the forgery it was built to prevent has
      // happened by accident.
      expect(ca.uplDirection?.expectedScope.advice).toBe(true);
      expect(ca.uplDirection?.expectedScope.openEndedResearch).toBe(true);
      const decision = evaluateAdvocacyWizardAccess(ca, TODAY);
      if (!decision.available) throw new Error('expected available');
      expect(decision.scope.advice).toBe(false);
      expect(decision.scope.openEndedResearch).toBe(false);
    });

    it('names the four facts that would turn the direction into a review', () => {
      expect(ca.uplDirection?.missing.length).toBe(4);
      const joined = ca.uplDirection!.missing.join(' ');
      expect(joined).toMatch(/bar number/i);
      expect(joined).toMatch(/name/i);
      expect(joined).toMatch(/date/i);
    });
  });
});
