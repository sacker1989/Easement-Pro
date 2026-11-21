/**
 * What to put in a folder today, so you can prove something later.
 *
 * THE HIGHEST-VALUE THING THIS PRODUCT CAN SAY, and it was the most
 * scattered. "Photograph the easement area, dated" appeared in
 * responsibilities.ts, should-exist.ts and the guides — four places, none of
 * them a step, none of them saying what the photograph is FOR.
 *
 * It is for the moment someone disputes what was there. A utility crew
 * trenches a lawn and restores it to "serviceable"; a storm moves water that
 * never went that way before; a fire takes the street and an adjuster asks
 * what the yard looked like. In every one of those the homeowner's position
 * rests on evidence they either gathered beforehand or did not. Altadena in
 * January 2025 is the case that makes this concrete: the records that mattered
 * afterwards were the ones taken before.
 *
 * COSTS NOTHING AND NEEDS NOBODY. This is the whole point of putting it
 * first. Every other step in the remedy plan eventually reaches a title
 * company, a utility, an attorney or an appraiser. This one is a phone camera
 * and a folder, it can be done this afternoon, and it is worth more than any
 * of the paid steps if the thing it protects against ever happens.
 *
 * WHAT IT IS NOT. Not legal advice, and not a claim strategy. It is a list of
 * what to keep. What any of it proves is a question for whoever is handling
 * the claim or the dispute, and the copy says so rather than implying that a
 * good folder wins arguments.
 */

/** When a record stops being optional. Events, not dates. */
export type RecordTrigger =
  /** Worth having before anything happens at all. */
  | 'before-anything'
  /** Before a crew, contractor or agency works on or near the easement. */
  | 'before-work'
  /** Immediately after any work, storm, fire or other damage. */
  | 'after-an-event'
  /** When you sell, or when a buyer's inspection asks. */
  | 'at-sale';

export const TRIGGER_LABEL: Record<RecordTrigger, string> = {
  'before-anything': 'Do this now',
  'before-work': 'Before anyone digs',
  'after-an-event': 'Right after anything happens',
  'at-sale': 'Before you sell',
};

export interface RecordToKeep {
  readonly id: string;
  /** Imperative, and specific enough to act on without thinking. */
  readonly what: string;
  /** The moment it earns its keep. Concrete, not ominous. */
  readonly whyItMatters: string;
  readonly trigger: RecordTrigger;
  /** How to actually do it, in one or two sentences. Free, always. */
  readonly how: string;
}

/**
 * Ordered by when you do them, not by importance.
 *
 * The photograph is first because it is the one that expires: you cannot take
 * a picture of how the garden looked before the trench, after the trench.
 */
export const RECORDS_TO_KEEP: readonly RecordToKeep[] = [
  {
    id: 'dated-photographs',
    what: 'Photograph the easement area and everything on it, with dates.',
    whyItMatters:
      'This is the record that cannot be recreated. An easement holder generally has to restore ' +
      'the surface after working, but "restore" usually means serviceable rather than identical ' +
      '— and the argument about what was there before is one you can only win with a picture ' +
      'taken before. Mature planting and custom hardscape are the losses that tend not to come ' +
      'back.',
    trigger: 'before-anything',
    how:
      'Phone camera, several angles, include something for scale and something that fixes the ' +
      'location — a corner of the house, the kerb. Make sure the date is on the file, which it ' +
      'is by default on every phone. Do it again each spring; planting changes.',
  },
  {
    id: 'the-documents',
    what: 'Put your deed, title policy, plat and any recorded easement in one place.',
    whyItMatters:
      'Every question this report cannot answer is answered in those documents, and most ' +
      'homeowners have them already — in the closing packet, unopened since the day they bought. ' +
      'The easement, if there is a recorded one, is described there and almost nowhere else.',
    trigger: 'before-anything',
    how:
      'Look for the closing packet first; it is free and it is probably in the house. If it is ' +
      'gone, your title insurer will usually re-send the policy, and the county recorder sells ' +
      'copies of anything recorded against your parcel.',
  },
  {
    id: 'insurance-declarations',
    what: 'Keep a current copy of your insurance declarations page, off-site.',
    whyItMatters:
      'The declarations page is what states your coverage and limits, and it is the first thing ' +
      'an adjuster asks for. Households that lose a house frequently lose the policy documents ' +
      'with it, which is why off-site matters more than tidy.',
    trigger: 'before-anything',
    how:
      'Email yourself a PDF, or put it in whatever cloud storage you already use. Add the claims ' +
      'phone number to your phone while you are there.',
  },
  {
    id: 'before-work-notice',
    what: 'When a crew is coming, write down who, when and what they said they would do.',
    whyItMatters:
      'Scope creep on an easement is ordinary and rarely malicious: a crew clears more than was ' +
      'discussed because it was in the way. A note made the day you were told, naming the person ' +
      'who told you, is worth more later than a clear memory.',
    trigger: 'before-work',
    how:
      'A dated note is enough — name, company, phone, what they said. If it was a phone call, ' +
      'email them afterwards saying what you understood; an unanswered email confirming your ' +
      'understanding is itself a record.',
  },
  {
    id: 'after-event-photographs',
    what: 'Photograph the damage or the work immediately, before anything is tidied.',
    whyItMatters:
      'The condition right after an event is the thing in dispute, and it is also the thing ' +
      'everyone wants to clean up first. Restoration, flooding and fire damage all look different ' +
      'a week later, and the week-later photographs are the ones that get argued about.',
    trigger: 'after-an-event',
    how:
      'Same as before: several angles, wide and close, with dates. Photograph the whole area as ' +
      'well as the damage, so the two can be placed against each other.',
  },
  {
    id: 'correspondence-thread',
    what: 'Keep every letter, email and call log in one thread.',
    whyItMatters:
      'What was asked, when, and what came back is frequently the whole question — especially ' +
      'where a holder was told about a problem and what happened next matters. A thread also ' +
      'shows you acted promptly, which is its own answer to a common objection.',
    trigger: 'after-an-event',
    how:
      'Put everything in one email folder, including notes of phone calls written the same day. ' +
      'Send letters so you can show they arrived, and keep the proof with the letter.',
  },
  {
    id: 'at-sale-disclosure',
    what: 'Keep what you learned, for the buyer who will ask.',
    whyItMatters:
      'A buyer’s title search finds the recorded easement and their inspection may find the ' +
      'infrastructure. Being able to hand over the document, the correspondence and the ' +
      'photographs turns a late surprise into a question already answered — and a late surprise ' +
      'is what costs money at closing.',
    trigger: 'at-sale',
    how:
      'The same folder. Nothing extra to do if you have kept the rest of this list.',
  },
];

export function recordsFor(trigger: RecordTrigger): readonly RecordToKeep[] {
  return RECORDS_TO_KEEP.filter((r) => r.trigger === trigger);
}

/** The one-line case for doing any of this. */
export const RECORDS_HEADLINE =
  'Everything on this list is free, takes an afternoon, and needs nobody’s permission. It is ' +
  'also the only part of this report you can finish today.';

/** Stated beneath the list. */
export const RECORDS_DISCLOSURE =
  'Keeping records is not a claim and does not decide one. What any of this proves depends on ' +
  'your policy, your easement document and the facts, and those are questions for your insurer, ' +
  'your adjuster or an attorney. What a folder does is make sure the answer turns on what ' +
  'happened rather than on what anyone can still remember.';
