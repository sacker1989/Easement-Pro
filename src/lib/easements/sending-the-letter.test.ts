import { describe, expect, it } from 'vitest';
import {
  LETTER_DISCLOSURE,
  LETTER_HEADLINE,
  LETTER_STEPS,
  STAGE_LABEL,
  stepsFor,
} from './sending-the-letter';
import { readSource, stripJsxComments } from '@/lib/test-support/source-text';
import { surfaceReadiness } from '@/lib/deployment/surfaces';

describe('the letter guidance covers the whole act of sending', () => {
  it('covers every stage it declares a label for', () => {
    for (const stage of Object.keys(STAGE_LABEL) as Array<keyof typeof STAGE_LABEL>) {
      expect(stepsFor(stage).length, `${stage} has no steps`).toBeGreaterThan(0);
    }
  });

  it('says what each step is FOR, not just to do it', () => {
    // Same failure mode as the records list: a reader who does not know what
    // the return receipt is for pays for it once and then stops.
    for (const s of LETTER_STEPS) {
      expect(s.whyItMatters.length, `${s.id} why is too thin`).toBeGreaterThan(80);
      expect(s.how.length, `${s.id} how is too thin`).toBeGreaterThan(60);
      expect(s.what).toMatch(/\.$/);
    }
  });

  it('starts by telling the reader the letter is theirs to correct', () => {
    // The tool drafted it from typed input plus public records. A reader who
    // sends it unread sends a description of a property nobody checked.
    expect(LETTER_STEPS[0]!.id).toBe('read-it-and-own-it');
    expect(LETTER_STEPS[0]!.stage).toBe('before-you-send');
  });

  it('keeps the record-of-silence step, which is the one that gets cut', () => {
    /*
     * A reader who hears nothing concludes the letter failed. The sequence
     * asked/delivered/no-reply is the cleanest account of what happened and
     * the easiest to throw away, so it is named as a step rather than left as
     * an implication of the others.
     */
    const silence = LETTER_STEPS.find((s) => s.id === 'write-down-the-silence');
    expect(silence, 'the silence step is gone').toBeDefined();
    expect(silence!.whyItMatters).toMatch(/no answer is a record/i);
  });
});

describe('it refuses the four conclusions a reader most wants', () => {
  /*
   * THE LOAD-BEARING TEST IN THIS FILE. A homeowner reading "send it certified
   * mail" naturally infers that sending it accomplishes something legal:
   * preserves a right, satisfies a notice requirement, starts a clock, or
   * makes the utility responsible. Each is a legal conclusion about a specific
   * document and specific facts, and this product reports records instead.
   *
   * Asserting on the runtime values rather than the source text, deliberately.
   * The module header and the disclosure both NAME these conclusions in order
   * to refuse them, and a source-text guard would match that prose — which is
   * the mistake this codebase has now made eleven times.
   */
  it('states all four refusals in the disclosure', () => {
    expect(LETTER_DISCLOSURE).toMatch(/does not by itself preserve a right/i);
    expect(LETTER_DISCLOSURE).toMatch(/notice requirement/i);
    expect(LETTER_DISCLOSURE).toMatch(/start or stop any deadline/i);
    expect(LETTER_DISCLOSURE).toMatch(/establish that anyone is responsible/i);
  });

  it('says who the reader should actually ask', () => {
    expect(LETTER_DISCLOSURE).toMatch(/attorney/i);
    expect(LETTER_DISCLOSURE).toMatch(/insurer/i);
    expect(LETTER_DISCLOSURE).toMatch(/not a law firm|not your attorney/i);
  });

  it('names the reader as author and sender', () => {
    // The product never transmits correspondence on a homeowner's behalf, and
    // the copy has to say so where the homeowner is reading it.
    expect(LETTER_DISCLOSURE).toMatch(/written by you and sent by you/i);
  });

  it('makes no affirmative legal claim in any step', () => {
    const steps = JSON.stringify(LETTER_STEPS).toLowerCase();
    for (const forbidden of [
      'preserves your right',
      'protects your right',
      'legally required',
      'obligated to',
      'they must',
      'will have to',
      'starts the clock',
      'proves they',
      'establishes liability',
      'you will win',
      'guarantees',
      'entitles you',
    ]) {
      expect(steps, `a step claims: ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('the postage is disclosed rather than buried', () => {
  it('marks exactly one step as costing money, and it is the mailing', () => {
    const paid = LETTER_STEPS.filter((s) => s.costsMoney);
    expect(paid).toHaveLength(1);
    expect(paid[0]!.id).toBe('send-it-provably');
  });

  it('says in the mailing step that it costs more than a stamp, and what that buys', () => {
    // The section's credibility rests on not having a dishonest sentence, and
    // "free" next to a certified mailing would be the one.
    const mail = LETTER_STEPS.find((s) => s.id === 'send-it-provably')!;
    expect(mail.how).toMatch(/costs a few dollars|more than a stamp|rather than the price of a stamp/i);
    expect(mail.how).toMatch(/receipt and signature card are what you are paying for/i);
  });

  it('does not claim in the headline that everything is free', () => {
    /*
     * The honest form names the exception. A future edit to "everything below
     * is free, and it is what turns a letter into something you can show"
     * would read better and be false, so the exception is asserted rather
     * than trusted to survive.
     */
    expect(LETTER_HEADLINE).toMatch(/except the postage/i);
    expect(LETTER_HEADLINE).not.toMatch(/everything below is free/i);
  });
});

describe('the guidance is actually reachable', () => {
  it('is rendered on the page that produces the letter', () => {
    const page = stripJsxComments(readSource(new URL('../../app/advocacy/page.tsx', import.meta.url)));
    expect(page).toContain('LETTER_STEPS');
    expect(page).toContain('LETTER_DISCLOSURE');
  });

  /*
   * MATCHING THE LINK AND NOT THE IMPORT. Both of these first failed on the
   * same thing: `/advocacy` appears at the top of report/page.tsx inside
   * `from '@/lib/advocacy/remedy-plan'`, 88,000 characters before any markup.
   * A bare indexOf('/advocacy') therefore passes whether the link exists or
   * not, and reported the records section as coming last when it comes first.
   *
   * The href is also written as a template literal — href={`/advocacy?...`} —
   * so the quote characters an href pattern expects are a brace and a
   * backtick. Both are in the pattern rather than assumed away.
   */
  const LINK_TO_LETTER = /href=\{?[`"'][^`"']*\/advocacy/;

  it('is linked from the report, which is where homeowners start', () => {
    /*
     * The letter tool was built, tested, deployed and linked from NOWHERE
     * until 2026-11-21. It was reachable only by typing /advocacy into the
     * address bar, so in practice no homeowner had seen it. A test, because
     * the failure was invisible: everything worked and nobody could get there.
     */
    const report = stripJsxComments(readSource(new URL('../../app/report/page.tsx', import.meta.url)));
    expect(report, 'the report does not link to the letter tool').toMatch(LINK_TO_LETTER);
  });

  it('does not link to the generator unless the generator works', () => {
    /*
     * VERIFIED AGAINST LIVE PRODUCTION, 2026-11-21. safehomevalue.com/advocacy
     * loads and answers "This letter was not generated", because an artefact
     * surface needs a durable audit store and a file path on a serverless host
     * is not one. An ungated link would have turned an invisible working
     * feature into a visible broken one, which is the worse of the two.
     *
     * The gate is surfaceReadiness, which already folds in the durable-store
     * condition, the state gate and the commerce gate.
     */
    const report = stripJsxComments(readSource(new URL('../../app/report/page.tsx', import.meta.url)));
    expect(report).toContain('letterToolWorks');
    const gate = report.indexOf('letterToolWorks ?');
    const link = report.search(LINK_TO_LETTER);
    expect(gate, 'the link is not behind the readiness gate').toBeGreaterThan(-1);
    expect(gate).toBeLessThan(link);
  });

  it('gives the advice even where the generator is down', () => {
    /*
     * The valuable part of this section is free and needs no software: send it
     * provably, keep the receipt with a copy, note the silence. A homeowner
     * can do all of that with a sheet of paper, so none of it sits behind the
     * generator's availability.
     */
    const report = stripJsxComments(readSource(new URL('../../app/report/page.tsx', import.meta.url)));
    const advice = report.indexOf('certified mail');
    const gate = report.indexOf('letterToolWorks ?');
    expect(advice, 'the certified-mail advice is gone').toBeGreaterThan(-1);
    expect(advice, 'the advice is trapped behind the generator gate').toBeLessThan(gate);
  });

  /*
   * THE GATE, TESTED AGAINST THE NEGATIVE CASE.
   *
   * A gate asserted only in the state where it is open is not tested; it is
   * observed. The condition that matters here is the one live production is
   * actually in — NODE_ENV=production with no AUDIT_LOG_PATH — because that is
   * the configuration that answers "This letter was not generated", and the
   * whole point of the gate is to not link to it.
   */
  const letterWorksWith = (env: Record<string, string | undefined>) =>
    surfaceReadiness('CA', env).find((s) => s.id === 'advocacy')?.works;

  it('closes in the configuration live production is in', () => {
    expect(letterWorksWith({ NODE_ENV: 'production' })).toBe(false);
    expect(letterWorksWith({ NODE_ENV: 'production', AUDIT_LOG_PATH: '' })).toBe(false);
  });

  it('opens once the audit store is configured', () => {
    // The fix is a durable store, and the link is supposed to come back on its
    // own when one is set rather than needing this code touched again.
    expect(letterWorksWith({ NODE_ENV: 'production', AUDIT_LOG_PATH: '/mnt/audit/sends.jsonl' }))
      .toBe(true);
  });

  it('gives a reason rather than failing silently', () => {
    const surface = surfaceReadiness('CA', { NODE_ENV: 'production' }).find(
      (s) => s.id === 'advocacy',
    );
    expect(surface!.degradedBecause).toMatch(/durable audit store/i);
  });

  it('puts the free records list before the letter, which costs postage', () => {
    // The user's instruction: records guidance is paramount and comes first.
    // The letter is the step after it, not instead of it.
    const report = stripJsxComments(readSource(new URL('../../app/report/page.tsx', import.meta.url)));
    const records = report.indexOf('What you can do yourself, today, for nothing');
    const letter = report.search(LINK_TO_LETTER);
    expect(records).toBeGreaterThan(-1);
    expect(letter).toBeGreaterThan(-1);
    expect(records).toBeLessThan(letter);
  });
});
