/**
 * Who the report is being read by: the owner of the land, or somebody
 * deciding whether to buy it.
 *
 * WHY THIS IS NOT JUST COPY. The underlying facts are identical — the same
 * parcel, the same restrictions, the same maintenance duties, the same county
 * figures. What differs is what the reader can DO about them, and that
 * changes which parts of the report matter:
 *
 *   An owner is answering "what do I have, and what is it costing me?" The
 *   encumbrance is already theirs. Their moves are slow ones: read the deed,
 *   ask the holder, get a survey if it matters, and live with the answer.
 *
 *   A buyer is answering "should I take this on, and at what price?" They
 *   have something an owner does not — the ability to walk away, or to make
 *   the answer somebody else's problem through the contract — and they have a
 *   deadline, because a contingency period runs out. Advice that ignores the
 *   deadline is advice they cannot use.
 *
 * THE BUYER PATH IS THE MORE DANGEROUS ONE TO GET WRONG, which is why the
 * disclaimers do not soften for it. A homeowner reading an overconfident
 * report may worry unnecessarily. A buyer reading one may pay more, waive a
 * contingency, or walk away from a house over a line on a volunteer map. The
 * tool does not know whether an easement exists; it says so to both.
 */

export type Audience = 'owner' | 'buyer';

export const AUDIENCES: readonly Audience[] = ['owner', 'buyer'];

/**
 * OWNER IS THE DEFAULT, and deliberately so. It is what the product was built
 * for, it is what every existing link and bookmark means, and an unrecognised
 * value resolving to the buyer flow would quietly change what an existing
 * reader is told. Unknown input resolves to owner rather than erroring,
 * because this is a query parameter and the report page learned this week
 * what unvalidated query parameters do.
 */
export function resolveAudience(raw: string | undefined): Audience {
  const cleaned = (raw ?? '').trim().toLowerCase();
  return cleaned === 'buyer' ? 'buyer' : 'owner';
}

export interface AudienceCopy {
  /** How the report refers to the land. */
  readonly propertyPhrase: string;
  /** Short label for the mode switch. */
  readonly label: string;
  /** One line under the report heading, orienting the reader. */
  readonly standfirst: string;
  /** What this reader should do next, in order. */
  readonly nextSteps: readonly string[];
  /** The leverage or constraint unique to this reader. */
  readonly timingNote: string;
}

const OWNER: AudienceCopy = {
  propertyPhrase: 'your property',
  label: 'I own this property',
  standfirst:
    'What the public record shows about your land, what it restricts, and who is responsible for ' +
    'maintaining what crosses it.',
  nextSteps: [
    'Find your deed and your title policy. The easement, if there is a recorded one, is described ' +
      'there and almost nowhere else — not in any map this tool can read.',
    'Look at the plat or subdivision map for your lot. Recorded utility and drainage easements are ' +
      'commonly drawn on it as strips along the lot lines, with a width.',
    'Photograph what is actually on the ground, dated. If a dispute ever arises, the cheapest ' +
      'evidence is the photograph you took before it did.',
    'Ask the holder directly. Utilities and agencies will usually tell you what they hold and what ' +
      'they are responsible for maintaining, and frequently the matter ends there.',
  ],
  timingNote:
    'There is no clock on this. An easement that has been there for decades will still be there ' +
    'next month, and the cheap steps above are worth doing before any step that costs money.',
};

const BUYER: AudienceCopy = {
  propertyPhrase: 'this property',
  label: 'I am considering buying it',
  standfirst:
    'What the public record shows about this land before you commit to it — what it restricts, ' +
    'who maintains what crosses it, and what to ask while you still have the leverage to ask.',
  nextSteps: [
    'Order the preliminary title report and read Schedule B. That is where recorded easements are ' +
      'listed, by document number. Nothing in this report replaces it, and it is the single thing ' +
      'most worth doing.',
    'Read the seller disclosures for anything about shared driveways, utility access, drainage, or ' +
      'a neighbor crossing the land. A disclosure that mentions an arrangement with nothing ' +
      'recorded behind it is worth asking about.',
    'Ask the seller or their agent, in writing, what they know about anyone else having a right to ' +
      'use the land. Written answers before closing are worth more than recollections after it.',
    'If the answer matters to what you would pay, get a survey showing the easements. It is the ' +
      'only way to see where a recorded strip actually falls on the lot.',
  ],
  timingNote:
    'You have a deadline and leverage, and they expire together. Most contracts give a window to ' +
    'investigate and withdraw; once it closes, what you did not ask becomes what you own. The ' +
    'title report and the written question cost little and are worth doing early in that window ' +
    'rather than at the end of it.',
};

const BY_AUDIENCE = { owner: OWNER, buyer: BUYER } satisfies Record<Audience, AudienceCopy>;

export function audienceCopy(audience: Audience): AudienceCopy {
  return BY_AUDIENCE[audience];
}

/**
 * Said to a buyer wherever a figure or a finding appears.
 *
 * SEPARATE FROM THE OWNER DISCLAIMERS, AND STRONGER, because the decision is
 * bigger and sooner. A buyer can act on this report in a way an owner cannot —
 * by paying more, by waiving a contingency, or by walking away — and all three
 * are expensive to get wrong on the strength of a screening tool that has not
 * read a single document.
 */
export const BUYER_DECISION_WARNING =
  'Do not price an offer, waive a contingency, or walk away from a purchase on the strength of ' +
  'this report. It reads public records and published map layers; it has not read the title ' +
  'report, the deed, or the plat, and those are where easements actually live. Use it to decide ' +
  'what to ask and what to order — not what to decide.';
