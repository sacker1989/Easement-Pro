/**
 * What SHOULD be on record and usually is not.
 *
 * THE THIRD QUESTION. The product already addresses what exists (the county
 * record and the proximity scan) and what could exist (the evidence tiers).
 * This is the one that protects value rather than merely describing it: the
 * documents a property ought to have, which cost little to create now and a
 * great deal to litigate later.
 *
 * THE ASYMMETRY IS THE WHOLE POINT, AND ALMOST NOBODY SEES IT.
 *
 * When you are BURDENED by an undocumented arrangement — a neighbour crosses
 * your land, a utility sits on it with nothing of record — time is broadly on
 * your side. There is nothing recorded for anyone to enforce against you, and
 * the claimant has to establish their right from scratch.
 *
 * When you are BENEFITED by one — your driveway crosses their lot, your
 * drainage outfalls onto theirs, your water line runs through their yard —
 * you are the exposed party. Your neighbour sells, the buyer finds nothing of
 * record, and you discover that the thing your property depends on was never
 * yours. This is the version that destroys value, and it is the version
 * homeowners worry about least, because the arrangement has worked fine for
 * twenty years and nobody has ever objected.
 *
 * So the headline question is not "is anything crossing my land". It is
 * "does my property depend on anything I do not own, and is that written
 * down". A free tool that gets a homeowner to ask that has earned its keep
 * before it says another word.
 *
 * WHAT THIS IS NOT. It does not tell anyone they have a claim, that a
 * neighbour must sign anything, or that an existing arrangement is invalid.
 * Every item is a document worth HAVING, with a path to getting it that
 * usually starts with a conversation. Pursuing anything against an unwilling
 * party is the paid next step and a different product.
 */

import type { EasementType } from './easement-types';

/**
 * Which side of the arrangement the homeowner is on.
 *
 * The field that decides how urgent everything else is. See the module header
 * — these are not symmetric and presenting them as a pair of equivalents is
 * the mistake this type exists to prevent.
 */
export type Posture =
  /** Something crosses your land. You own it; they use it. */
  | 'burdened'
  /** Your property depends on something across someone else's land. */
  | 'benefited'
  /** Both, or shared — the usual case for driveways and private roads. */
  | 'mutual';

/** When this stops being cheap to fix. Events, not dates. */
export type Trigger =
  | 'when-either-of-you-sells'
  | 'when-it-fails-or-needs-work'
  | 'when-the-relationship-changes'
  | 'already';

export interface MissingDocument {
  readonly id: string;
  /** The situation, in the homeowner's words. */
  readonly situation: string;
  readonly posture: Posture;
  /** The document that ought to exist. */
  readonly whatShouldExist: string;
  readonly whyItMatters: string;
  /** What happens if nobody does anything. Concrete, not ominous. */
  readonly ifYouDoNothing: string;
  /** The cheap path. Usually a conversation before it is ever a lawyer. */
  readonly howToStart: string;
  readonly becomesUrgent: Trigger;
}

export const TRIGGER_LABEL: Record<Trigger, string> = {
  'when-either-of-you-sells': 'When either of you sells',
  'when-it-fails-or-needs-work': 'When it fails or needs work',
  'when-the-relationship-changes': 'When the neighbours change',
  already: 'Already worth doing',
};

/**
 * THE ONE TO READ FIRST, and it applies to every easement type.
 *
 * Exported separately rather than buried in a list because a homeowner who
 * reads nothing else should read this, and because it is the item most likely
 * to be genuinely new to them.
 */
export const BENEFITED_AND_UNRECORDED: MissingDocument = {
  id: 'benefited-unrecorded',
  situation:
    'Something your property depends on — a driveway, a water or sewer line, a drainage outfall, ' +
    'a path to the road — runs across land you do not own, and nothing is recorded granting you ' +
    'the right to it.',
  posture: 'benefited',
  whatShouldExist:
    'A recorded easement in your favour, signed by the owner of the land it crosses, describing ' +
    'what you may do and where.',
  whyItMatters:
    'This is the exposure homeowners most consistently underestimate, and it runs the opposite way ' +
    'from the one they worry about. Being burdened by an undocumented arrangement is mostly ' +
    'survivable — nothing is recorded for anyone to enforce against you. Being BENEFITED by one ' +
    'means the thing your property relies on is not yours, and it can end.',
  ifYouDoNothing:
    'Usually nothing, for years. Then the neighbour sells. The new owner’s title search finds no ' +
    'easement, they have no relationship with you and no reason to continue the arrangement, and ' +
    'the first you hear of it may be a fence. If what you lose is access to a public road, the ' +
    'effect on your property’s value is not marginal.',
  howToStart:
    'Check your own title documents first — it may already be recorded and simply unknown to you, ' +
    'which is the common and happy outcome. If it is not, raising it with a neighbour you are ' +
    'currently on good terms with is both the cheapest moment and the likeliest to succeed. ' +
    'Neighbours generally agree to write down an arrangement they are already honouring.',
  becomesUrgent: 'when-either-of-you-sells',
};

/**
 * Also universal: an easement that exists but does not say where it is.
 *
 * Common in older instruments, and the ambiguity usually surfaces at the worst
 * possible time — when someone wants to build.
 */
export const VAGUE_EXISTING_EASEMENT: MissingDocument = {
  id: 'vague-existing',
  situation:
    'An easement is recorded, but it describes itself loosely — "over a portion of Lot 7", "for ' +
    'utility purposes", with no width, no location and no plan attached.',
  posture: 'burdened',
  whatShouldExist:
    'A recorded clarification or amendment fixing the location and width, ideally with a survey or ' +
    'plan attached.',
  whyItMatters:
    'A vague easement is not a small easement. Where the document does not say where the right ' +
    'runs, the practical answer tends to be wherever the holder reasonably needs it — which is ' +
    'more of your land than a defined strip would have been, and it is impossible to plan around.',
  ifYouDoNothing:
    'It stays dormant until you want to build, sell, or refuse something — and then the ambiguity ' +
    'is resolved under pressure, by negotiation or worse, rather than at leisure.',
  howToStart:
    'Ask the holder whether they will confirm the alignment in writing. Utilities frequently will, ' +
    'because a defined easement is easier for them to administer too, and the request costs you ' +
    'nothing but a letter.',
  becomesUrgent: 'when-it-fails-or-needs-work',
};

const SHARED_MAINTENANCE: MissingDocument = {
  id: 'shared-maintenance',
  situation:
    'You share a driveway, private road or access way with one or more neighbours, and there is no ' +
    'recorded agreement saying who maintains it or who pays.',
  posture: 'mutual',
  whatShouldExist:
    'A recorded shared maintenance agreement: who maintains what, how costs are split, how ' +
    'decisions get made, and what happens when someone will not pay.',
  whyItMatters:
    'Shared access with no written maintenance terms is among the most reliable sources of ' +
    'neighbour disputes there is, and the disputes are rarely about the money. They are about the ' +
    'absence of a rule, which means every repair is renegotiated from nothing.',
  ifYouDoNothing:
    'It works until the surface fails. Then whoever cares most pays, resents it, and the next ' +
    'owner inherits the resentment. Lenders and buyers also ask about this — a shared drive with ' +
    'no agreement is a routine complication at sale.',
  howToStart:
    'Write down how it actually works today — who uses it, who has paid for what — and propose ' +
    'that as the agreement. Codifying the existing practice is far easier to get signed than ' +
    'negotiating a new arrangement, and this is the single most useful document a shared-access ' +
    'property can have.',
  becomesUrgent: 'when-the-relationship-changes',
};

const UTILITY_PRESENT_NO_RECORD: MissingDocument = {
  id: 'utility-no-record',
  situation:
    'Utility infrastructure sits on or crosses your parcel and you can find nothing recorded that ' +
    'grants the right to have it there.',
  posture: 'burdened',
  whatShouldExist:
    'Either a located, recorded easement, or written confirmation from the utility of what they ' +
    'claim and where.',
  whyItMatters:
    'Three quite different things look identical from your garden: an easement that exists and you ' +
    'have not found, a prescriptive right built up over years of use, and infrastructure with no ' +
    'right behind it at all. Which one you have changes everything, and none of them is settled by ' +
    'looking at the pole.',
  ifYouDoNothing:
    'Usually nothing happens. The cost lands at sale, when a buyer asks what the line across the ' +
    'back is and nobody can answer, or when you want to build and discover the question has never ' +
    'been resolved.',
  howToStart:
    'Ask the utility directly what they hold over your parcel and request a copy. They generally ' +
    'know, it is free to ask, and their answer is useful whichever of the three it turns out to be.',
  becomesUrgent: 'when-either-of-you-sells',
};

const LONG_USE_NO_DOCUMENT: MissingDocument = {
  id: 'long-use-no-document',
  situation:
    'A neighbour has used part of your land for years — a track, a turning area, a path — and ' +
    'nothing was ever written down.',
  posture: 'burdened',
  whatShouldExist:
    'A written licence, if you are content for the use to continue. A licence is permission that ' +
    'you can revoke; it is deliberately NOT an easement.',
  whyItMatters:
    'Permission and a right look the same from the outside and are completely different in law. ' +
    'Use that continues without permission can, over enough years, harden into a right you cannot ' +
    'withdraw. A written licence records that the use is permitted, which is the distinction that ' +
    'matters later.',
  ifYouDoNothing:
    'The use continues and its character stays unresolved. Whether that is a problem depends on ' +
    'facts about the use that only an attorney can weigh — this is the one item here where acting ' +
    'without advice can make things worse rather than better.',
  howToStart:
    'Write down what you have observed: who uses it, how, how often, and since when. Dates and ' +
    'specifics. That record costs nothing, it is the first thing anyone you consult will ask for, ' +
    'and it is worth having before you decide anything.',
  becomesUrgent: 'already',
};

const DRAINAGE_UNDERSTANDING: MissingDocument = {
  id: 'drainage-understanding',
  situation:
    'Water crosses a boundary — yours onto theirs, or theirs onto yours — by an arrangement nobody ' +
    'ever documented.',
  posture: 'mutual',
  whatShouldExist:
    'A recorded drainage easement, or at minimum a written understanding of where water is ' +
    'expected to go and who maintains what carries it.',
  whyItMatters:
    'Drainage disputes are unusually bitter because the harm is physical and recurring, and because ' +
    'small changes on one side — a patio, a fence, a regrade — produce large effects on the other. ' +
    'Liability can also be created by accident, by someone improving their own land.',
  ifYouDoNothing:
    'It holds until a heavy storm or a landscaping project changes where the water goes. Then ' +
    'someone has standing water and a strong view about whose fault it is.',
  howToStart:
    'Photograph where water actually runs during the next heavy rain, from both sides if you can. ' +
    'Observed behaviour settles more drainage arguments than any plan does, and it is free.',
  becomesUrgent: 'when-it-fails-or-needs-work',
};

/**
 * Which items apply to a given easement type.
 *
 * `BENEFITED_AND_UNRECORDED` is on every single one, deliberately. It is the
 * item least likely to be top of mind and most likely to matter, and gating it
 * behind an easement type the user already knows about would surface it only
 * to people who had already worked out they had a problem.
 */
const BY_TYPE = {
  'utility-overhead': [UTILITY_PRESENT_NO_RECORD, VAGUE_EXISTING_EASEMENT],
  'utility-underground': [UTILITY_PRESENT_NO_RECORD, VAGUE_EXISTING_EASEMENT],
  sewer: [UTILITY_PRESENT_NO_RECORD, VAGUE_EXISTING_EASEMENT],
  'storm-drain': [UTILITY_PRESENT_NO_RECORD, DRAINAGE_UNDERSTANDING],
  'water-line': [UTILITY_PRESENT_NO_RECORD, VAGUE_EXISTING_EASEMENT],
  pipeline: [UTILITY_PRESENT_NO_RECORD, VAGUE_EXISTING_EASEMENT],
  'access-ingress-egress': [SHARED_MAINTENANCE, VAGUE_EXISTING_EASEMENT],
  'public-right-of-way': [VAGUE_EXISTING_EASEMENT],
  drainage: [DRAINAGE_UNDERSTANDING, VAGUE_EXISTING_EASEMENT],
  slope: [VAGUE_EXISTING_EASEMENT],
  conservation: [VAGUE_EXISTING_EASEMENT],
  prescriptive: [LONG_USE_NO_DOCUMENT, SHARED_MAINTENANCE],
} satisfies Record<EasementType, readonly MissingDocument[]>;

/**
 * What should exist, for this easement type.
 *
 * The benefited-and-unrecorded item leads every list. That ordering is the
 * argument of the module header expressed as a sort: the exposure that runs
 * against the homeowner comes before the ones that run in their favour.
 */
export function whatShouldExist(easementType: EasementType): readonly MissingDocument[] {
  return [BENEFITED_AND_UNRECORDED, ...BY_TYPE[easementType]];
}

/** The question worth asking before any of the detail. */
export const THE_QUESTION_TO_ASK =
  'Does my property depend on anything I do not own — a driveway, a utility line, a drainage ' +
  'route, a way to the road — and is that written down anywhere?';

export const SHOULD_EXIST_DISCLOSURE =
  'Nothing here says you have a claim, that a neighbour or utility must sign anything, or that an ' +
  'existing arrangement is invalid. These are documents worth HAVING, and the path to each of them ' +
  'usually starts with a conversation rather than a lawyer. What this tool cannot tell you is ' +
  'whether any of them already exist for your property — that takes a title search, and your own ' +
  'closing documents are the free place to look first.';
