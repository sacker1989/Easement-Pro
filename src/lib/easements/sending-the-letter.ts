/**
 * What to do with the letter once the tool has handed it to you.
 *
 * THE GAP THIS CLOSES. Until now the wizard produced a letter, rendered it in
 * a <pre>, and stopped. A homeowner holding a correctly drafted letter and no
 * idea what to do with it is barely better off than one holding nothing: the
 * value of a maintenance request is almost entirely in the record it leaves,
 * and the record depends on how it is sent and what is kept afterwards. Those
 * are the two things the product never said.
 *
 * WHY THE SENDING METHOD IS THE WHOLE POINT. A letter that arrives and is
 * ignored, with proof of delivery, is worth more later than a letter that
 * produced a friendly phone call and no paper. The dispute this folder exists
 * for is not "did you ask" — it is "when did you ask, what did you ask for,
 * and what happened next", and all three are questions about records rather
 * than about the letter's wording.
 *
 * SILENCE IS A RECORD, and it is the one homeowners throw away. Someone who
 * hears nothing back concludes the letter failed and stops keeping anything.
 * The date they sent it, the proof it arrived, and the absence of any reply
 * are together a cleaner account of what happened than a half-remembered call,
 * and they cost nothing to keep.
 *
 * WHAT THIS IS NOT, and the line is narrow enough to be worth stating twice.
 * This says how to create and keep a record. It does NOT say that sending a
 * letter preserves a right, satisfies any notice requirement, starts or stops
 * any clock, or establishes that anyone is responsible for anything. Every one
 * of those is a legal conclusion about a specific document and a specific set
 * of facts, and this product does not reach them. What a record is worth is a
 * question for an insurer, an adjuster or an attorney; what the record IS, is
 * the only thing described here.
 *
 * COST. Six of these seven steps are free. The exception is postage, and it is
 * named rather than buried — certified mail with a return receipt runs a few
 * dollars, and the step says so and says what the few dollars buy. Pretending
 * a mailing is free would be the one dishonest sentence in a section whose
 * entire credibility rests on not having any.
 */

/** When each step happens. Events, not dates — same shape as records-to-keep. */
export type LetterStage =
  /** Before it goes anywhere. */
  | 'before-you-send'
  /** The act of sending, and how. */
  | 'when-you-send'
  /** The weeks after, including the weeks where nothing happens. */
  | 'after-you-send'
  /** If it ever becomes a claim, a sale or a dispute. */
  | 'if-it-matters-later';

export const STAGE_LABEL: Record<LetterStage, string> = {
  'before-you-send': 'Before you send it',
  'when-you-send': 'Sending it',
  'after-you-send': 'After you send it',
  'if-it-matters-later': 'If you ever need it',
};

export interface LetterStep {
  readonly id: string;
  /** Imperative, specific enough to act on without deciding anything. */
  readonly what: string;
  /** What this step is for. Concrete. */
  readonly whyItMatters: string;
  readonly stage: LetterStage;
  /** How to actually do it. */
  readonly how: string;
  /** True only where the step costs the homeowner money. Postage, and nothing else. */
  readonly costsMoney?: boolean;
}

export const LETTER_STEPS: readonly LetterStep[] = [
  {
    id: 'read-it-and-own-it',
    what: 'Read it through and correct anything that is not true of your property.',
    whyItMatters:
      'This becomes your letter the moment you sign it, and it was drafted from what you typed ' +
      'plus public records — neither of which knows your property the way you do. A letter that ' +
      'describes the wrong thing is worse than no letter, because it is the version the recipient ' +
      'will quote back to you.',
    stage: 'before-you-send',
    how:
      'Check the address, the name of the utility or agency, and the description of what needs ' +
      'maintaining. Change anything that reads wrong — plain language is fine, and it does not ' +
      'have to sound legal to be effective.',
  },
  {
    id: 'find-the-right-recipient',
    what: 'Send it to the office that handles the infrastructure, not the general inquiries line.',
    whyItMatters:
      'A letter that reaches the wrong desk inside the right organization can sit there without ' +
      'anyone being at fault, and you will have proof of delivery to an office that was never ' +
      'going to act. The correct recipient is usually a named department rather than a person.',
    stage: 'before-you-send',
    how:
      'Look on the utility or agency website for the department that handles easements, ' +
      'right-of-way, or field maintenance, and use the postal address it publishes. If only a ' +
      'general address is published, use it and address the letter to that department by name.',
  },
  {
    id: 'send-it-provably',
    what: 'Send it so that you can later show it arrived — certified mail with a return receipt.',
    whyItMatters:
      'This is the step that converts a letter into a record. Regular mail leaves you asserting ' +
      'that you wrote; certified mail with a return receipt leaves you holding the date it was ' +
      'delivered and a signature for it. Where it later matters whether the holder was told ' +
      'about a problem, that receipt is the part that is hard to argue with.',
    stage: 'when-you-send',
    how:
      'Any US post office will do this at the counter — ask for certified mail with return ' +
      'receipt requested. It costs a few dollars rather than the price of a stamp, and the ' +
      'receipt and signature card are what you are paying for. Email as well if you like, but do ' +
      'not let the email replace the mailing.',
    costsMoney: true,
  },
  {
    id: 'keep-what-you-sent',
    what: 'Keep a copy of the exact letter you signed, with the date you sent it.',
    whyItMatters:
      'Months later the question becomes what you actually asked for, and a letter that has been ' +
      'edited since it was sent cannot answer it. The copy matters as much as the original, and ' +
      'it is the easiest thing on this list to skip.',
    stage: 'when-you-send',
    how:
      'Photograph or scan the signed letter before it goes in the envelope, and save it with the ' +
      'date in the filename. Put it in the same folder as everything else from this report.',
  },
  {
    id: 'keep-the-proof-with-the-copy',
    what: 'Keep the mailing receipt and the signature card with that copy, not somewhere else.',
    whyItMatters:
      'A receipt in a drawer and a letter on a computer are two half-records. Together they show ' +
      'what was sent and that it arrived, which is the pair that answers the question; separately ' +
      'they tend to be found one at a time, years apart.',
    stage: 'after-you-send',
    how:
      'When the signature card comes back, photograph it next to the letter copy or scan both ' +
      'into one file. If you keep paper, one envelope with both in it is enough.',
  },
  {
    id: 'write-down-the-silence',
    what: 'Note the date you sent it and what came back — including when nothing does.',
    whyItMatters:
      'No answer is a record, and it is the one people throw away because it feels like failure. ' +
      'The sequence — asked on this date, delivered on that date, no reply by this date — is a ' +
      'clearer account of what happened than any recollection, and most homeowners only realize ' +
      'they wanted it once it is too late to reconstruct.',
    stage: 'after-you-send',
    how:
      'One dated line in a note or the same email thread. If you do get a reply or a call, write ' +
      'down who, when and what they said the same day, and keep any letter or email they send. ' +
      'If a crew then comes out, photograph the area before and after they work.',
  },
  {
    id: 'hand-the-folder-over',
    what: 'Keep the folder, and hand it over whole if this ever becomes a claim, a sale or a dispute.',
    whyItMatters:
      'The people who can act on this — an adjuster, an attorney, a buyer’s agent — start by ' +
      'asking what happened and when. Arriving with the letter, the delivery proof, the dated ' +
      'photographs and a note of the silence answers most of a first meeting, and it is the ' +
      'difference between being able to show a sequence of events and having to describe one.',
    stage: 'if-it-matters-later',
    how:
      'Nothing extra to do if you have kept the rest of this list. Keep a copy somewhere other ' +
      'than the house — emailed to yourself is enough — because the events this protects against ' +
      'are the ones that destroy the house.',
  },
];

export function stepsFor(stage: LetterStage): readonly LetterStep[] {
  return LETTER_STEPS.filter((s) => s.stage === stage);
}

/** The one-line case, stated above the steps. */
export const LETTER_HEADLINE =
  'The letter is worth what the record around it is worth. Everything below except the postage is ' +
  'free, and it is what turns a letter you sent into something you can show someone later.';

/**
 * Stated beneath the steps.
 *
 * Deliberately refuses the four conclusions a reader most wants here: that
 * sending preserves a right, satisfies a notice requirement, starts a clock,
 * or makes anyone responsible. Each is a legal conclusion about a specific
 * document, and this product reports records rather than deciding them.
 */
export const LETTER_DISCLOSURE =
  'This letter is written by you and sent by you, and this tool is not a law firm and is not ' +
  'your attorney. Sending it does not by itself preserve a right, satisfy any legal notice ' +
  'requirement, start or stop any deadline, or establish that anyone is responsible for ' +
  'anything — those depend on your easement document, your policy and the facts, and they are ' +
  'questions for an attorney or your insurer. What sending it does do is create a dated record ' +
  'of what you asked for and what happened next, which is the thing that is difficult to ' +
  'recreate afterwards and costs almost nothing to keep now.';
