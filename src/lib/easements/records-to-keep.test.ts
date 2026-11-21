import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  RECORDS_DISCLOSURE,
  RECORDS_HEADLINE,
  RECORDS_TO_KEEP,
  recordsFor,
  TRIGGER_LABEL,
} from './records-to-keep';

describe('the records list is the free step, and stays free', () => {
  it('covers every trigger it declares a label for', () => {
    for (const trigger of Object.keys(TRIGGER_LABEL) as Array<keyof typeof TRIGGER_LABEL>) {
      expect(recordsFor(trigger).length, `${trigger} has no records`).toBeGreaterThan(0);
    }
  });

  it('never sends the reader to someone who charges', () => {
    /*
     * THE WHOLE POINT. Every other step in the remedy plan eventually reaches
     * a title company, a utility, an attorney or an appraiser. This list is a
     * phone camera and a folder, and it is the only part of the report a
     * homeowner can finish the same afternoon. A "how" that starts by hiring
     * someone has stopped being this.
     */
    for (const r of RECORDS_TO_KEEP) {
      expect(r.how.toLowerCase(), `${r.id} sends the reader to a paid professional`).not.toMatch(
        /\bhire\b|\bretain\b|\bpay (a|an|for)\b|\border an appraisal\b|\bengage an attorney\b/,
      );
    }
  });

  it('says what each record is FOR, not just to keep it', () => {
    // The scattered version said "photograph the easement area, dated" in four
    // places and never said why. A reader who does not know what the
    // photograph is for does not take it.
    for (const r of RECORDS_TO_KEEP) {
      expect(r.whyItMatters.length, `${r.id} why is too thin`).toBeGreaterThan(80);
      expect(r.how.length, `${r.id} how is too thin`).toBeGreaterThan(60);
      expect(r.what).toMatch(/\.$/);
    }
  });

  it('leads with the record that cannot be recreated', () => {
    // You cannot photograph how the garden looked before the trench, after
    // the trench. Everything else on this list can be obtained later.
    expect(RECORDS_TO_KEEP[0]!.id).toBe('dated-photographs');
    expect(RECORDS_TO_KEEP[0]!.trigger).toBe('before-anything');
    expect(RECORDS_TO_KEEP[0]!.whyItMatters).toMatch(/cannot be recreated/i);
  });

  it('does not promise that a folder wins an argument', () => {
    /*
     * Keeping records is not a claim and does not decide one. The disclosure
     * has to say that, because the failure mode of this section is a reader
     * who believes good paperwork is a result.
     */
    expect(RECORDS_DISCLOSURE).toMatch(/not a claim and does not decide one/i);
    expect(RECORDS_DISCLOSURE).toMatch(/insurer|adjuster|attorney/i);
    const all = JSON.stringify(RECORDS_TO_KEEP).toLowerCase();
    for (const forbidden of ['you will win', 'guarantees', 'entitles you', 'proves your claim']) {
      expect(all, `found: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('says it is free and finishable today', () => {
    expect(RECORDS_HEADLINE).toMatch(/free/i);
    expect(RECORDS_HEADLINE).toMatch(/today/i);
  });
});

describe('the report puts records before the paid steps', () => {
  const PAGE = readFileSync(new URL('../../app/report/page.tsx', import.meta.url), 'utf8');

  it('renders the records section above the remedy plan', () => {
    const records = PAGE.indexOf('What you can do yourself, today, for nothing');
    const remedy = PAGE.indexOf('What to do about it, in order');
    expect(records).toBeGreaterThan(-1);
    expect(remedy).toBeGreaterThan(-1);
    expect(records).toBeLessThan(remedy);
  });

  it('is not gated on a parcel match or an easement type', () => {
    // It applies to everyone who reaches a report. Gating it the way the fire
    // panel was gated is exactly how a section becomes invisible.
    const section = PAGE.slice(PAGE.indexOf('What you can do yourself'), PAGE.indexOf('{remedy &&'));
    expect(section).not.toMatch(/easementType ===/);
    expect(section).not.toMatch(/unified !== null/);
  });
});
