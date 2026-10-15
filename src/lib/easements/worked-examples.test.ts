import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from './easement-types';
import {
  WORKED_EXAMPLE_DISCLAIMER,
  workedExampleFor,
  type WorkedExample,
} from './worked-examples';

describe('every easement type has a worked example', () => {
  it.each(EASEMENT_TYPES)('%s', (type) => {
    const e = workedExampleFor(type);
    expect(e.situation.length).toBeGreaterThan(40);
    expect(e.whatTheReportShows.length).toBeGreaterThan(40);
    expect(e.whatYouDo.length).toBeGreaterThan(40);
    expect(e.whatThatGetsYou.length).toBeGreaterThan(40);
  });

  it('covers all four of the jobs they were asked to demonstrate', () => {
    // Protect value, raise a grievance, get it maintained, avoid a risk.
    const served = new Set(EASEMENT_TYPES.map((t) => workedExampleFor(t).serves));
    expect([...served].sort()).toEqual(
      ['avoid a risk', 'get it maintained', 'protect value', 'raise a grievance'].sort(),
    );
  });
});

describe('they are illustrations, not case studies', () => {
  const all: readonly WorkedExample[] = EASEMENT_TYPES.map(workedExampleFor);
  const text = all
    .map((e) => `${e.situation} ${e.whatTheReportShows} ${e.whatYouDo} ${e.whatThatGetsYou}`)
    .join(' ');

  it('states no dollar figure or percentage anywhere', () => {
    /*
     * A DECISION WITH A DATE ON IT. The SCREENING-BANDS-UNCITED risk
     * acceptance was renewed on 2026-10-13 with a trigger written into it:
     * revisit "if any marketing copy states a specific dollar figure or
     * percentage rather than an unquantified claim about scale". An example
     * saying "saved $12,000" would be marketing copy stating a specific
     * dollar figure, resting on percentage bands no appraiser has reviewed,
     * for a transaction that never happened. Three reasons, any one enough.
     */
    expect(text).not.toMatch(/\$[\d,]/);
    expect(text).not.toMatch(/\b\d+\s?%/);
    expect(text).not.toMatch(/\bsaved?\s+(?:you\s+)?(?:\$|\d)/i);
  });

  it('invents no homeowner, no place, and no outcome that happened', () => {
    /*
     * guide-content.ts already holds this rule for the incident sections:
     * nothing invents a holder name, a process step, a legal outcome, or a
     * homeowner story. The same applies here, and here it is more tempting,
     * because a testimonial is the most persuasive thing this product could
     * publish and the least defensible.
     */
    for (const tell of [
      ' recovered ',
      ' was awarded ',
      'one homeowner',
      'a homeowner in',
      'told us',
      'reported back',
      'success story',
    ]) {
      expect(text.toLowerCase(), `reads as a case study: ${tell}`).not.toContain(tell);
    }
  });

  it('ends each example on an action completed, not a sum recovered', () => {
    /*
     * The honest version of "how this saves you money". What the product can
     * genuinely help with is getting a thing done — the document found, the
     * work scheduled, the build moved, the question answered before closing.
     * What it cannot do is tell you what that was worth.
     */
    for (const type of EASEMENT_TYPES) {
      const outcome = workedExampleFor(type).whatThatGetsYou;
      expect(outcome, `${type} promises a sum`).not.toMatch(/\$|\bworth\b.*\b\d/);
    }
  });

  it('carries a disclaimer that names what it is not', () => {
    expect(WORKED_EXAMPLE_DISCLAIMER).toMatch(/not an account of something that happened/);
    expect(WORKED_EXAMPLE_DISCLAIMER).toMatch(/Nobody here is a real homeowner/);
  });
});
