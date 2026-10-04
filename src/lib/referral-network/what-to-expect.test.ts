import { describe, expect, it } from 'vitest';
import {
  APPRAISER_EXPECTATION,
  ATTORNEY_EXPECTATION,
  EXPECTATIONS,
  NO_LIST_NO_FEE,
} from './what-to-expect';

describe('both professionals get a best and a worst case', () => {
  for (const e of EXPECTATIONS) {
    it(`${e.kind}: has both, and neither is empty`, () => {
      expect(e.bestCase.length).toBeGreaterThan(1);
      expect(e.worstCase.length).toBeGreaterThan(1);
      expect(e.whatTheyDo.length).toBeGreaterThan(40);
    });
  }

  it('stays short — this is orientation, not a checklist', () => {
    // An earlier draft carried red flags, scripted questions and a credential
    // explainer. That is for someone already deep in the problem; a homeowner
    // who just learned the word "easement" needs to know what they are buying.
    for (const e of EXPECTATIONS) {
      expect(e.bestCase.length).toBeLessThanOrEqual(4);
      expect(e.worstCase.length).toBeLessThanOrEqual(4);
    }
    expect(Object.keys(APPRAISER_EXPECTATION)).toEqual([
      'kind',
      'heading',
      'whatTheyDo',
      'bestCase',
      'worstCase',
    ]);
  });
});

describe('the worst case names the shortcut this product itself shows', () => {
  it('tells the reader the rough range IS the rejected method', () => {
    // The page shows a percentage-of-land-value range. Saying "a percentage is
    // the bad answer" without admitting ours uses the same arithmetic would be
    // holding an appraiser to a standard this report does not meet.
    const worst = APPRAISER_EXPECTATION.worstCase.join(' ');
    expect(worst).toMatch(/percentage of your land value/);
    expect(worst).toMatch(/same arithmetic\s+as the rough range on this page/);
  });

  it('anchors the best case to before-and-after', () => {
    expect(APPRAISER_EXPECTATION.bestCase.join(' ')).toMatch(/value your property twice|values your property twice|twice/i);
    expect(APPRAISER_EXPECTATION.bestCase.join(' ')).toMatch(/controlling federal standard requires/);
  });

  it('puts reading the document first for the attorney', () => {
    expect(ATTORNEY_EXPECTATION.bestCase[0]).toMatch(/read your recorded easement document/);
    expect(ATTORNEY_EXPECTATION.worstCase.join(' ')).toMatch(/has not seen the paperwork/);
  });

  it('names doing nothing as a real option', () => {
    // Often the right answer, and the one a salesperson never mentions.
    expect(ATTORNEY_EXPECTATION.bestCase.join(' ')).toMatch(/doing nothing, which is often the\s+right answer/);
  });
});

describe('no list, no fee', () => {
  it('says both halves', () => {
    expect(NO_LIST_NO_FEE).toMatch(/keeps no list/);
    expect(NO_LIST_NO_FEE).toMatch(/takes no referral fee/);
    expect(NO_LIST_NO_FEE).toMatch(/state bar runs a lawyer\s+referral service/);
  });
});
