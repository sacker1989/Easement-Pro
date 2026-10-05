import { describe, expect, it } from 'vitest';
import { EASEMENT_TYPES } from './easement-types';
import {
  BENEFITED_AND_UNRECORDED,
  SHOULD_EXIST_DISCLOSURE,
  THE_QUESTION_TO_ASK,
  TRIGGER_LABEL,
  whatShouldExist,
} from './should-exist';

describe('whatShouldExist', () => {
  it('returns something for every easement type', () => {
    for (const t of EASEMENT_TYPES) {
      expect(whatShouldExist(t).length, t).toBeGreaterThanOrEqual(2);
    }
  });

  it('leads with the benefited exposure, for every type', () => {
    // THE ORDERING IS THE ARGUMENT. Being benefited by an undocumented
    // arrangement is the exposure that runs AGAINST the homeowner, and it is
    // the one they are least likely to have thought about. Gating it behind an
    // easement type would surface it only to people who had already worked out
    // they had a problem.
    for (const t of EASEMENT_TYPES) {
      expect(whatShouldExist(t)[0]!.id, t).toBe('benefited-unrecorded');
    }
  });

  it('gives each item a unique id within a list', () => {
    for (const t of EASEMENT_TYPES) {
      const ids = whatShouldExist(t).map((d) => d.id);
      expect(new Set(ids).size, t).toBe(ids.length);
    }
  });

  it('labels every trigger it can return', () => {
    for (const t of EASEMENT_TYPES) {
      for (const d of whatShouldExist(t)) {
        expect(TRIGGER_LABEL[d.becomesUrgent], `${t}/${d.id}`).toBeDefined();
      }
    }
  });
});

describe('the asymmetry, which is the point of the module', () => {
  it('states that being benefited is the worse position', () => {
    const why = BENEFITED_AND_UNRECORDED.whyItMatters;
    expect(BENEFITED_AND_UNRECORDED.posture).toBe('benefited');
    // If this ever softens into "both sides should document things", the
    // insight has been lost and the module is a generic checklist.
    expect(why).toMatch(/opposite way/i);
    expect(why).toMatch(/underestimate/i);
  });

  it('names the concrete way it goes wrong rather than being ominous', () => {
    // "The neighbour sells, the buyer finds nothing, the first you hear is a
    // fence" is actionable. "You could lose your rights" is not.
    expect(BENEFITED_AND_UNRECORDED.ifYouDoNothing).toMatch(/sells/i);
    expect(BENEFITED_AND_UNRECORDED.ifYouDoNothing).toMatch(/fence|title search/i);
  });

  it('points at the happy outcome first', () => {
    // Checking your own title documents is free and frequently resolves it.
    // Sending someone to a lawyer before they have looked in their own closing
    // file would be both expensive and usually unnecessary.
    expect(BENEFITED_AND_UNRECORDED.howToStart).toMatch(/your own title documents first/i);
  });
});

describe('it stays on the free side of the line', () => {
  const everything = () =>
    EASEMENT_TYPES.flatMap((t) => whatShouldExist(t)).map((d) => JSON.stringify(d).toLowerCase());

  it('never asserts a claim or an obligation on anyone else', () => {
    // Pursuing something against an unwilling party is the paid next step.
    for (const d of everything()) {
      for (const forbidden of [
        'you are entitled to',
        'you have a claim',
        'you can sue',
        'they must sign',
        'they are required to grant',
        'is invalid',
      ]) {
        expect(d, `found: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('starts every item with something the homeowner can do themselves', () => {
    for (const t of EASEMENT_TYPES) {
      for (const d of whatShouldExist(t)) {
        expect(d.howToStart.length, `${t}/${d.id}`).toBeGreaterThan(60);
        // No item may open by sending them to a professional. One does mention
        // consulting an attorney — the prescriptive one — and that is correct
        // and deliberate, but it still leads with the free step.
        expect(d.howToStart.slice(0, 60).toLowerCase(), `${t}/${d.id}`).not.toMatch(
          /hire|retain|instruct a (solicitor|lawyer)/,
        );
      }
    }
  });

  it('tells the prescriptive case to get advice before acting', () => {
    // The one place where doing something yourself can make it worse. The
    // free step is still free — write down what you have observed — but the
    // item says plainly that acting is not a DIY matter.
    const item = whatShouldExist('prescriptive').find((d) => d.id === 'long-use-no-document')!;
    expect(item.ifYouDoNothing).toMatch(/attorney/i);
    expect(item.howToStart).toMatch(/costs nothing/i);
  });

  it('distinguishes a licence from an easement where it matters', () => {
    // Giving written permission is protective; accidentally granting a right
    // is not. An item that told someone to "write something down" without that
    // distinction would be actively harmful.
    const item = whatShouldExist('prescriptive').find((d) => d.id === 'long-use-no-document')!;
    expect(item.whatShouldExist).toMatch(/licence/i);
    expect(item.whatShouldExist).toMatch(/NOT an easement/);
  });
});

describe('the framing copy', () => {
  it('asks the dependency question rather than the intrusion question', () => {
    // "What crosses my land" is what people arrive asking. "What does my
    // property depend on that I do not own" is the one that protects value.
    expect(THE_QUESTION_TO_ASK).toMatch(/depend on anything I do not own/i);
    expect(THE_QUESTION_TO_ASK).toMatch(/written down/i);
  });

  it('admits the tool cannot tell them whether these already exist', () => {
    // The honest limit. A list of documents you should have is misleading if
    // the reader assumes the tool checked whether they have them.
    expect(SHOULD_EXIST_DISCLOSURE).toMatch(/cannot tell you is whether any of them already exist/i);
    expect(SHOULD_EXIST_DISCLOSURE).toMatch(/title search/i);
    expect(SHOULD_EXIST_DISCLOSURE).toMatch(/conversation rather than a lawyer/i);
  });
});
