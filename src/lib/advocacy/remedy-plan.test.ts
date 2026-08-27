import { describe, expect, it } from 'vitest';
import { buildRemedyPlan, COST_TIER_LABEL, type RemedyPlanInputs } from './remedy-plan';
import { EASEMENT_TYPES } from '@/lib/easements/easement-types';

function inputs(over: Partial<RemedyPlanInputs> = {}): RemedyPlanInputs {
  return {
    easementType: 'utility-overhead',
    instrumentInHand: false,
    easementConfirmed: false,
    areaEstablished: false,
    acquisitionPending: false,
    hasScreeningRange: true,
    ...over,
  };
}

describe('the sequence is the advice', () => {
  it('starts with confirming the easement exists, not with hiring anyone', () => {
    // Paying an appraiser to value an easement nobody can produce a document
    // for is the most expensive way to discover it may not exist.
    const plan = buildRemedyPlan(inputs());
    expect(plan.startHere.title).toMatch(/Confirm the easement actually exists/);
    expect(plan.startHere.cost).not.toBe('professional-fee');
  });

  it('puts every free and low-cost step before the professional ones', () => {
    const plan = buildRemedyPlan(inputs());
    const firstProfessional = plan.steps.findIndex((s) => s.cost === 'professional-fee');
    const lastCheap = plan.steps
      .map((s, i) => (s.cost === 'records-fee' || s.cost === 'free' ? i : -1))
      .reduce((a, b) => Math.max(a, b), -1);
    expect(firstProfessional).toBeGreaterThan(-1);
    expect(lastCheap).toBeLessThan(firstProfessional);
  });

  it('tells people what not to pay for yet', () => {
    expect(buildRemedyPlan(inputs()).sequencingNote).toMatch(/stop when your question is answered/);
    expect(buildRemedyPlan(inputs()).sequencingNote).toMatch(/settled for nothing at step one/i);
  });

  it('numbers the steps consecutively from one', () => {
    const plan = buildRemedyPlan(inputs());
    expect(plan.steps.map((s) => s.order)).toEqual(plan.steps.map((_, i) => i + 1));
  });
});

describe('it does not tell people to redo work they have done', () => {
  it('drops the confirm step once the easement is confirmed', () => {
    const plan = buildRemedyPlan(inputs({ easementConfirmed: true }));
    expect(plan.steps.some((s) => /Confirm the easement actually exists/.test(s.title))).toBe(false);
  });

  it('drops the instrument step once it is in hand', () => {
    const plan = buildRemedyPlan(inputs({ instrumentInHand: true }));
    expect(plan.steps.some((s) => /Get a copy of the easement instrument/.test(s.title))).toBe(false);
  });

  it('drops the survey step once the area is established', () => {
    const plan = buildRemedyPlan(inputs({ areaEstablished: true }));
    expect(plan.steps.some((s) => /Establish the encumbered area/.test(s.title))).toBe(false);
  });

  it('still produces a usable plan when everything is already known', () => {
    const plan = buildRemedyPlan(
      inputs({ easementConfirmed: true, instrumentInHand: true, areaEstablished: true }),
    );
    expect(plan.steps.length).toBeGreaterThanOrEqual(3);
    expect(plan.startHere).toBeDefined();
  });
});

describe('a pending acquisition breaks the cheap-first rule, deliberately', () => {
  it('inserts the attorney step and says why it is out of order', () => {
    // An offer with a deadline does not wait for the cheap steps to finish,
    // and some rights are harder to assert after acceptance.
    const plan = buildRemedyPlan(inputs({ acquisitionPending: true }));
    const attorney = plan.steps.find((s) => s.actor === 'attorney');
    expect(attorney).toBeDefined();
    expect(attorney!.whyNow).toMatch(/Out of sequence deliberately/);
  });

  it('raises an urgency notice only when one is pending', () => {
    expect(buildRemedyPlan(inputs({ acquisitionPending: true })).urgencyNote).toMatch(
      /BEFORE\s+signing/,
    );
    expect(buildRemedyPlan(inputs()).urgencyNote).toBeNull();
  });
});

describe('cost is a tier, never an invented dollar figure', () => {
  it('states no dollar amounts anywhere in the plan', () => {
    // This project has no sourced fee data for any market. Commit daaad19
    // exists solely to replace a fabricated cost with a sourced one.
    const plan = buildRemedyPlan(inputs({ acquisitionPending: true }));
    const text = JSON.stringify(plan) + Object.values(COST_TIER_LABEL).join(' ');
    expect(text).not.toMatch(/\$\d/);
  });

  it('tells the user to get a quote for professional steps', () => {
    expect(COST_TIER_LABEL['professional-fee']).toMatch(/obtain a quote/);
    expect(COST_TIER_LABEL['professional-fee']).toMatch(/no fee data/);
  });

  it('marks which steps this tool can actually provide', () => {
    const plan = buildRemedyPlan(inputs());
    const ours = plan.steps.filter((s) => s.weCanProvide);
    expect(ours.length).toBeGreaterThanOrEqual(2);
    for (const s of ours) expect(s.actor).toBe('this tool');
    // And the reverse: nothing claims we provide an appraisal or legal advice.
    for (const s of plan.steps) {
      if (s.actor === 'licensed appraiser' || s.actor === 'attorney') {
        expect(s.weCanProvide).toBe(false);
      }
    }
  });
});

describe('the appraisal step is framed against the screening range', () => {
  it('explains the range exists to size this decision', () => {
    const plan = buildRemedyPlan(inputs({ hasScreeningRange: true }));
    const appraisal = plan.steps.find((s) => s.actor === 'licensed appraiser')!;
    expect(appraisal.whyNow).toMatch(/worth paying to find out the real figure/);
    expect(appraisal.outcome).toMatch(/the screening range on this page is not/);
  });

  it('changes its reasoning when no range could be produced', () => {
    const plan = buildRemedyPlan(inputs({ hasScreeningRange: false }));
    const appraisal = plan.steps.find((s) => s.actor === 'licensed appraiser')!;
    expect(appraisal.whyNow).toMatch(/only route to a figure of any kind/);
  });
});

describe('every easement type produces a plan', () => {
  for (const type of EASEMENT_TYPES) {
    it(`${type} yields an ordered plan with a starting step`, () => {
      const plan = buildRemedyPlan(inputs({ easementType: type }));
      expect(plan.steps.length).toBeGreaterThan(2);
      expect(plan.startHere.order).toBe(1);
      for (const s of plan.steps) {
        expect(s.outcome.length).toBeGreaterThan(30);
        expect(s.whyNow.length).toBeGreaterThan(20);
      }
    });
  }
});
