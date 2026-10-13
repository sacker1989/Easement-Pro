import { describe, expect, it } from 'vitest';
import {
  AUDIENCES,
  audienceCopy,
  BUYER_DECISION_WARNING,
  resolveAudience,
  type Audience,
} from './audience-mode';

describe('resolving the audience from a query parameter', () => {
  it('defaults to the owner, which is what every existing link means', () => {
    /*
     * An unrecognised value resolving to the buyer flow would quietly change
     * what an existing reader is told. Owner is what the product was built
     * for and what every bookmark already means.
     */
    expect(resolveAudience(undefined)).toBe('owner');
    expect(resolveAudience('')).toBe('owner');
    expect(resolveAudience('owner')).toBe('owner');
  });

  it('accepts the buyer, case and whitespace insensitively', () => {
    expect(resolveAudience('buyer')).toBe('buyer');
    expect(resolveAudience('Buyer')).toBe('buyer');
    expect(resolveAudience('  BUYER  ')).toBe('buyer');
  });

  it('never throws on junk, because this is a query parameter', () => {
    /*
     * The report page learned this week what unvalidated query parameters do:
     * `?state=California` and an unknown easementType were both live HTTP
     * 500s. Resolving rather than erroring is the lesson applied.
     */
    for (const junk of ['../../etc/passwd', 'seller', '%00', 'true', '1']) {
      expect(resolveAudience(junk)).toBe('owner');
    }
  });
});

describe('what actually differs between the two readers', () => {
  const owner = audienceCopy('owner');
  const buyer = audienceCopy('buyer');

  it('speaks about the land differently', () => {
    expect(owner.propertyPhrase).toBe('your property');
    expect(buyer.propertyPhrase).toBe('this property');
  });

  it('sends the owner to the deed and the buyer to the title report', () => {
    /*
     * THE SUBSTANTIVE DIFFERENCE, not a tone one. An owner already has a deed
     * and a title policy in a drawer. A buyer does not, and the preliminary
     * title report's Schedule B is where recorded easements are listed before
     * a purchase — the single most useful thing they can order.
     */
    expect(owner.nextSteps[0]).toMatch(/deed/i);
    expect(buyer.nextSteps[0]).toMatch(/preliminary title report/i);
    expect(buyer.nextSteps[0]).toMatch(/Schedule B/);
  });

  it('tells the buyer the clock is the point and the owner that it is not', () => {
    /*
     * A buyer has something an owner does not — the ability to walk away, or
     * to make it the seller's problem through the contract — and it expires.
     * Advice that ignores the contingency window is advice they cannot use.
     */
    expect(buyer.timingNote).toMatch(/contingency|deadline|window/i);
    expect(owner.timingNote).toMatch(/no clock|next month/i);
  });

  it('gives the buyer the step that only works before closing', () => {
    // A written question to the seller is worthless the day after completion
    // and cheap the week before it.
    expect(buyer.nextSteps.join(' ')).toMatch(/in writing|written/i);
    expect(buyer.nextSteps.join(' ')).toMatch(/seller disclosure/i);
  });

  it('covers every audience exhaustively', () => {
    for (const audience of AUDIENCES) {
      const copy = audienceCopy(audience);
      expect(copy.nextSteps.length).toBeGreaterThanOrEqual(3);
      expect(copy.standfirst.length).toBeGreaterThan(40);
      expect(copy.label.length).toBeGreaterThan(5);
    }
    const all: Audience[] = ['owner', 'buyer'];
    expect(AUDIENCES.slice().sort()).toEqual(all.sort());
  });
});

describe('the buyer warning does not soften', () => {
  it('names the three expensive ways to misuse this report', () => {
    /*
     * THE BUYER PATH IS THE MORE DANGEROUS ONE TO GET WRONG. An owner reading
     * an overconfident report may worry unnecessarily. A buyer may pay more,
     * waive a contingency, or walk away from a house — all three expensive,
     * all three on the strength of a tool that has read no documents.
     */
    expect(BUYER_DECISION_WARNING).toMatch(/price an offer/i);
    expect(BUYER_DECISION_WARNING).toMatch(/waive a contingency/i);
    expect(BUYER_DECISION_WARNING).toMatch(/walk away/i);
  });

  it('says what it has not read', () => {
    expect(BUYER_DECISION_WARNING).toMatch(/has not read the title report, the deed, or the plat/);
  });

  it('is at least as strong as anything shown to an owner', () => {
    // A mode aimed at a bigger, sooner decision must not come with lighter
    // caveats than the one aimed at a slower choice.
    expect(BUYER_DECISION_WARNING.length).toBeGreaterThan(audienceCopy('owner').timingNote.length);
  });
});
