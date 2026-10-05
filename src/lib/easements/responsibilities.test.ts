import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from './easement-types';
import {
  RESPONSIBILITIES_BY_TYPE,
  RESPONSIBILITIES_DISCLOSURE,
  responsibilitiesFor,
} from './responsibilities';

describe('RESPONSIBILITIES_BY_TYPE', () => {
  it('covers every easement type', () => {
    for (const t of EASEMENT_TYPES) {
      expect(responsibilitiesFor(t), `${t} has no responsibilities record`).toBeDefined();
      expect(responsibilitiesFor(t).easementType).toBe(t);
    }
    expect(Object.keys(RESPONSIBILITIES_BY_TYPE).length).toBe(EASEMENT_TYPES.length);
  });

  it('answers the value question for every type, since that is why they are reading', () => {
    for (const t of EASEMENT_TYPES) {
      const r = responsibilitiesFor(t);
      expect(r.valueAndProtection.length, `${t} value note too thin`).toBeGreaterThan(80);
      expect(r.freeNextStep.length, `${t} next step too thin`).toBeGreaterThan(40);
    }
  });

  it('gives a free next step, not a paid one', () => {
    // THE WHOLE POINT OF THE FREE TIER. If a next step ever reads "hire an
    // appraiser" or "retain counsel", it has stopped being the free product's
    // job and become a sales pitch. Those recommendations belong in the
    // what-to-expect guidance, where they are framed as shopping advice.
    for (const t of EASEMENT_TYPES) {
      const step = responsibilitiesFor(t).freeNextStep.toLowerCase();
      expect(step, `${t} next step should not require paying anyone`).not.toMatch(
        /\bhire\b|\bretain\b|\bpay for\b|\border an appraisal\b/,
      );
    }
  });

  it('marks every record as document-controlled', () => {
    // A literal `true` on the type, so a record cannot be added without it and
    // a surface rendering one responsibility cannot drop the caveat.
    for (const t of EASEMENT_TYPES) {
      expect(responsibilitiesFor(t).documentControls).toBe(true);
    }
  });

  describe('each responsibility is an expectation, not a holding', () => {
    it('states what is typical and what would change it', () => {
      for (const t of EASEMENT_TYPES) {
        for (const r of responsibilitiesFor(t).responsibilities) {
          expect(r.question, `${t}: question should be a question`).toMatch(/\?$/);
          expect(r.answer.length).toBeGreaterThan(60);
          // Naming what flips the answer is what makes this useful rather than
          // a generic hedge: it tells the reader what to go and look for.
          expect(r.whatWouldChangeIt.length, `${t}/${r.question}`).toBeGreaterThan(40);
          expect(['holder', 'owner', 'shared', 'depends-on-document']).toContain(r.typically);
        }
      }
    });

    it('never tells the homeowner they have a claim', () => {
      // Pursuing a claim is the paid next step and a different product. This
      // one explains the landscape so they can tell whether there is anything
      // worth pursuing — which is also the honest order, since usually there
      // is not.
      const all = JSON.stringify(RESPONSIBILITIES_BY_TYPE).toLowerCase();
      for (const forbidden of [
        'you are entitled to',
        'you have a claim',
        'you can sue',
        'demand that they',
        'they are required to compensate you',
      ]) {
        expect(all, `found claim-asserting language: ${forbidden}`).not.toContain(forbidden);
      }
    });

    it('gives at least three responsibilities per type', () => {
      for (const t of EASEMENT_TYPES) {
        expect(responsibilitiesFor(t).responsibilities.length, t).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('the answers that are worth the most', () => {
    it('warns that the sewer LATERAL is usually the homeowner’s', () => {
      // The single most expensive surprise in this file. Owners assume an
      // easement means the agency owns everything under their yard.
      const sewer = responsibilitiesFor('sewer');
      const lateral = sewer.responsibilities.find((r) => r.question.includes('lateral'));
      expect(lateral).toBeDefined();
      expect(lateral!.typically).toBe('owner');
      expect(lateral!.answer).toMatch(/under the public street/i);
    });

    it('treats a prescriptive claim as a reason to pause before acting', () => {
      const p = responsibilitiesFor('prescriptive');
      const blocking = p.responsibilities.find((r) => r.question.toLowerCase().includes('block'));
      expect(blocking).toBeDefined();
      expect(blocking!.whatWouldChangeIt).toMatch(/attorney/i);
    });

    it('refuses a percentage rule of thumb where it would mislead most', () => {
      // Access and conservation affect the whole parcel or its development
      // potential. A strip percentage is wrong for both, and the screening
      // estimate already says so — these must not contradict it.
      expect(responsibilitiesFor('access-ingress-egress').valueAndProtection).toMatch(
        /whole parcel|rule-of-thumb|rule of thumb/i,
      );
      expect(responsibilitiesFor('conservation').valueAndProtection).toMatch(
        /rule of thumb|rules of thumb/i,
      );
    });
  });

  it('carries a disclosure that says the document controls, in plain words', () => {
    expect(RESPONSIBILITIES_DISCLOSURE).toMatch(/not legal advice/i);
    expect(RESPONSIBILITIES_DISCLOSURE).toMatch(/your document controls/i);
    // It must say the general rule can be WRONG for this reader, not merely
    // that it is general.
    expect(RESPONSIBILITIES_DISCLOSURE).toMatch(/say the opposite/i);
  });
});
