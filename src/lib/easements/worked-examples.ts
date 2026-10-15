import type { EasementType } from './easement-types';
import { EASEMENT_TYPES } from './easement-types';

/**
 * One worked example per easement type: what a reader does with the report.
 *
 * WHAT THESE ARE. A short, concrete walk-through of a situation, what the
 * report shows for it, the specific next move, and what that move achieves.
 * They answer the question the rest of the Learn page does not — "fine, but
 * what do I DO with this?" — which is the gap between a reader understanding
 * their easement and acting on it.
 *
 * WHAT THESE ARE NOT, and this is the governing constraint.
 *
 * NOT CASE STUDIES. No homeowner here is real, no outcome here happened. They
 * are written as "this is how the tool is used", in the second person and the
 * conditional, never as "a homeowner in Pasadena recovered X". A fabricated
 * testimonial is the most persuasive thing this product could publish and the
 * least defensible, and `guide-content.ts` already holds the rule: nothing
 * invents a holder name, a process step, a legal outcome, or a homeowner
 * story.
 *
 * NOT MONEY. Not one of these states a dollar figure or a percentage saved,
 * and that is a decision with a date on it. The SCREENING-BANDS-UNCITED risk
 * acceptance was renewed on 2026-10-13 with a new trigger written into it:
 * revisit "if any marketing copy states a specific dollar figure or
 * percentage rather than an unquantified claim about scale". Worked examples
 * saying "saved $12,000" would be marketing copy stating a specific dollar
 * figure, resting on percentage bands no appraiser has reviewed, for a
 * transaction that never occurred. Three separate reasons, any one of them
 * sufficient.
 *
 * So the outcome of each example is an ACTION COMPLETED, not a sum recovered:
 * the document found, the work scheduled, the build moved, the question
 * answered before closing. Those are things the product can genuinely help
 * with, and they are what a homeowner actually needs to happen.
 */

export interface WorkedExample {
  /** The situation, in one sentence a reader recognises. */
  readonly situation: string;
  /** What the report puts in front of them. Only things it really produces. */
  readonly whatTheReportShows: string;
  /** The specific next move, concrete enough to do this week. */
  readonly whatYouDo: string;
  /** What that achieves. An action completed, never a sum recovered. */
  readonly whatThatGetsYou: string;
  /** Which of the four jobs this example mainly serves. */
  readonly serves: 'protect value' | 'raise a grievance' | 'get it maintained' | 'avoid a risk';
}

const EXAMPLES = {
  'utility-overhead': {
    serves: 'get it maintained',
    situation:
      'A branch has grown into the span crossing the back of your lot, and you are not sure ' +
      'whether cutting it is your job, the utility’s, or something you are not allowed to touch.',
    whatTheReportShows:
      'Which party normally carries vegetation management and line repair for an overhead ' +
      'utility easement, that building and permanent structures under the span are generally ' +
      'restricted, and — where the data exists — the line itself with its operator and whether ' +
      'it runs overhead or underground.',
    whatYouDo:
      'Photograph the encroachment with a date, then report it to the named operator rather than ' +
      'to the city, quoting the line and the location. Keep the reference number.',
    whatThatGetsYou:
      'The clearance work goes on the operator’s schedule under their own vegetation ' +
      'obligations, and you have a dated record that you reported it — which is the document ' +
      'that matters if the line later causes damage.',
  },
  'utility-underground': {
    serves: 'avoid a risk',
    situation:
      'You are planning a deck footing or a tree, and you know there is something buried along ' +
      'the side of the lot but not where, or how deep.',
    whatTheReportShows:
      'That excavation and deep-rooted planting are generally restricted within an underground ' +
      'utility easement, who is responsible for restoring your land after they dig, and what ' +
      'document should record the strip’s width — which usually turns out not to exist.',
    whatYouDo:
      'Call 811 before you put a spade in the ground, and ask the title company for the recorded ' +
      'instrument so you know the width rather than guessing at it.',
    whatThatGetsYou:
      'The footing goes somewhere that will not have to come out, and you learn the strip’s ' +
      'real width before you have built across it rather than after.',
  },
  sewer: {
    serves: 'raise a grievance',
    situation:
      'Your drains are backing up, and the water authority says the problem is on your side of ' +
      'the line while you suspect it is on theirs.',
    whatTheReportShows:
      'Where the responsibility usually divides between a private lateral and a public main, and ' +
      '— in the counties that publish it — the main itself with its diameter, material, ' +
      'and distance from your boundary.',
    whatYouDo:
      'Put the question in writing to the authority naming the main the report identified, and ' +
      'ask them to confirm in writing where the boundary of their responsibility falls.',
    whatThatGetsYou:
      'A written answer rather than a doorstep one. If the fault is theirs it is now their ' +
      'repair; if it is yours you have stopped paying to investigate the wrong pipe.',
  },
  'storm-drain': {
    serves: 'get it maintained',
    situation:
      'Water pools against the back fence every winter, and there is a grate or a pipe on the ' +
      'lot that nobody has touched in years.',
    whatTheReportShows:
      'Who normally maintains a storm drain easement, that blocking or re-grading it is ' +
      'generally restricted, and — where the county publishes a stormwater network — the ' +
      'line near your parcel, including whether it is privately owned rather than the city’s.',
    whatYouDo:
      'If the line is the city’s, report the blockage and keep the reference. If it is marked ' +
      'private, find out who the private owner is before winter, because that answer decides ' +
      'who pays.',
    whatThatGetsYou:
      'The clearing is scheduled by whoever actually owes it, and you are not quietly absorbing ' +
      'a duty that belongs to a neighbour, a developer, or an association.',
  },
  'water-line': {
    serves: 'avoid a risk',
    situation:
      'You want to build over or near a water main crossing the property, and nobody will give ' +
      'you a straight answer about whether you can.',
    whatTheReportShows:
      'That this type is treated conservatively, what is generally restricted above a water ' +
      'easement, who is responsible for repair and for putting the ground back afterwards, and ' +
      'what the recorded document ought to say.',
    whatYouDo:
      'Take the restriction list to the authority before you draw plans, and ask specifically ' +
      'what they permit within the strip and what they will require removed for access.',
    whatThatGetsYou:
      'A design that survives the permit rather than one that gets ordered out later, and the ' +
      'answer in writing before an architect has been paid to draw the wrong thing.',
  },
  pipeline: {
    serves: 'avoid a risk',
    situation:
      'There is a marker post at the edge of the property and you have no idea what it governs ' +
      'or how close you can work to it.',
    whatTheReportShows:
      'That pipeline easements are treated as the most restrictive class here, who holds ' +
      'maintenance and inspection duties, and what the instrument should record about width and ' +
      'permitted use.',
    whatYouDo:
      'Contact the operator named on the marker before any ground work, and ask for the recorded ' +
      'easement and their current encroachment rules in writing.',
    whatThatGetsYou:
      'You find out what is prohibited before you do it, on the one easement type where the ' +
      'consequence of guessing wrong is not merely expensive.',
  },
  'access-ingress-egress': {
    serves: 'raise a grievance',
    situation:
      'A shared driveway serves you and two neighbours, the surface is breaking up, and nobody ' +
      'agrees who pays.',
    whatTheReportShows:
      'How maintenance is usually shared on an access easement, that gating or narrowing it ' +
      'without agreement is generally restricted, and that the absence of a recorded maintenance ' +
      'agreement is the ordinary reason these turn into disputes.',
    whatYouDo:
      'Write down who actually uses the way and how often, then propose a recorded maintenance ' +
      'agreement splitting costs in proportion to use — as a conversation, not a demand.',
    whatThatGetsYou:
      'The dispute is prevented rather than won. A recorded agreement costs little, is usually ' +
      'welcomed, and settles the question for whoever owns these houses next.',
  },
  'public-right-of-way': {
    serves: 'avoid a risk',
    situation:
      'You are about to replace a fence, or you have inherited one, and you do not know how far ' +
      'back from the kerb the public right of way actually runs.',
    whatTheReportShows:
      'That the right of way commonly extends further from the kerb than owners assume, which ' +
      'parts of the frontage you are usually expected to maintain, and that permitted work ' +
      'inside the right of way can still be ordered removed.',
    whatYouDo:
      'Measure back from the kerb and ring the city to ask the right-of-way width for your ' +
      'street before the fence goes in. Where something is already built, ask specifically ' +
      'about an encroachment agreement.',
    whatThatGetsYou:
      'The fence goes on your land the first time. Where it is already in, you find out whether ' +
      'the city will permit it to stay — a question with a formal answer, asked before a ' +
      'letter arrives rather than after.',
  },
  drainage: {
    serves: 'avoid a risk',
    situation:
      'You want to pave, fill a low spot, or extend the patio across the dip at the bottom of ' +
      'the garden.',
    whatTheReportShows:
      'That a drainage easement is a path water is allowed to take, that blocking or re-routing ' +
      'it is generally restricted, and that doing so can move water onto a neighbour and create ' +
      'a liability that did not exist before.',
    whatYouDo:
      'Walk the lot during rain and photograph where the water actually goes before you change ' +
      'the grade, and check the plat for a marked drainage course.',
    whatThatGetsYou:
      'You avoid creating a liability to a neighbour with a weekend’s landscaping — which is ' +
      'the specific risk of this easement type, and the one owners most often do not know they ' +
      'are taking.',
  },
  slope: {
    serves: 'protect value',
    situation:
      'Part of the lot is a graded bank you cannot build on, and you are not sure whether that ' +
      'is a rule, an easement, or just the shape of the ground.',
    whatTheReportShows:
      'That slope easements are treated conservatively here, what is generally restricted on a ' +
      'graded bank, who carries responsibility for its stability, and what the recorded ' +
      'instrument should say about alteration.',
    whatYouDo:
      'Get the recorded document before you plan anything on the bank, and before you buy if ' +
      'you have not yet.',
    whatThatGetsYou:
      'You know which part of the lot is genuinely usable before you pay for it or plan around ' +
      'it — and a slope easement is one of the easements most likely to be mistaken for ' +
      'ordinary back garden.',
  },
  conservation: {
    serves: 'protect value',
    situation:
      'The property is subject to a conservation restriction and you want to know what it ' +
      'actually permits before you commit.',
    whatTheReportShows:
      'That this type is treated conservatively, what is generally restricted, who holds ' +
      'monitoring and enforcement duties, and that the terms live in the recorded instrument ' +
      'rather than in any map.',
    whatYouDo:
      'Read the recorded easement itself, and have a professional read it with you if a purchase ' +
      'or a build depends on it. The terms vary far more between conservation easements than ' +
      'between any other type.',
    whatThatGetsYou:
      'You learn what the land can be used for from the document that governs it, rather than ' +
      'from an assumption about what "conservation" usually means.',
  },
  prescriptive: {
    serves: 'raise a grievance',
    situation:
      'A neighbour has been crossing your land for years, there is nothing in writing, and you ' +
      'are starting to wonder whether that use has become a right.',
    whatTheReportShows:
      'That a prescriptive claim rests on use rather than on any document, what the report can ' +
      'and cannot determine about it, and that nothing in the public record will settle it.',
    whatYouDo:
      'Write down and photograph what is actually happening and since when, dated. Then take it ' +
      'to a licensed professional in your state, because this is the type where the outcome ' +
      'turns on facts and local law rather than on records.',
    whatThatGetsYou:
      'The factual record exists before anyone disputes it, which is the cheapest thing you can ' +
      'do about a prescriptive claim and the one thing that cannot be done retrospectively.',
  },
} satisfies Record<EasementType, WorkedExample>;

export function workedExampleFor(type: EasementType): WorkedExample {
  return EXAMPLES[type];
}

/** Every type has one; `satisfies` above makes a gap a compile error. */
export const WORKED_EXAMPLE_TYPES: readonly EasementType[] = EASEMENT_TYPES;

/**
 * Said above any worked example, every time.
 *
 * THE ONE SENTENCE THAT KEEPS THESE HONEST. Without it a reader takes a
 * walk-through for a case study, and a case study for a promise.
 */
export const WORKED_EXAMPLE_DISCLAIMER =
  'This is an illustration of how the report is used, not an account of something that happened. ' +
  'Nobody here is a real homeowner, and what any particular situation is worth or costs depends ' +
  'on facts this tool cannot see.';
