/**
 * The ordered plan: what to do next about this easement, in what order, and
 * who has to do each step.
 *
 * WHY ORDERING IS THE PRODUCT HERE. A homeowner who has just learned an
 * easement crosses their lot does not lack options — they lack a sequence. The
 * expensive steps (appraiser, attorney) are worth taking only after the cheap
 * ones (read the instrument, confirm it exists, establish the area) have
 * answered whether there is anything to argue about. Half of what this plan
 * does is tell people what NOT to pay for yet.
 *
 * COST IS STATED AS A TIER, NOT A DOLLAR FIGURE. This project has no sourced
 * data on appraiser or attorney fees in any market, and inventing one would be
 * the same failure as inventing an encumbrance factor — commit daaad19 exists
 * solely to replace a fabricated cost with a sourced one. Tiers are honest and
 * still decision-useful: someone needs to know whether the next step is free,
 * tens of dollars, or four figures, and they can get a real quote from there.
 */

import type { EasementType } from '@/lib/easements/easement-types';

/** Who performs the step. Mirrors the not-determined `Resolver` vocabulary. */
export type StepActor = 'you' | 'this tool' | 'the county or agency' | 'licensed appraiser' | 'attorney';

/**
 * Cost band rather than a dollar figure. See the module header: no fee data
 * has been sourced, and a fabricated number would be worse than a tier.
 */
export type CostTier = 'free' | 'records-fee' | 'our-fee' | 'professional-fee';

export const COST_TIER_LABEL: Record<CostTier, string> = {
  free: 'No cost',
  'records-fee': 'Copying or search fee, usually small — the agency sets it',
  'our-fee': 'Included in this service',
  'professional-fee': 'Professional fee — obtain a quote; this tool has no fee data for your market',
};

export interface RemedyStep {
  readonly order: number;
  readonly title: string;
  /** What this step actually gets you. */
  readonly outcome: string;
  readonly actor: StepActor;
  readonly cost: CostTier;
  /** Why it sits here in the sequence rather than earlier or later. */
  readonly whyNow: string;
  /** True where this tool can generate the artefact for the step. */
  readonly weCanProvide: boolean;
  /** Skip conditions, so nobody pays for a step they do not need. */
  readonly skipIf?: string;
}

export interface RemedyPlanInputs {
  readonly easementType: EasementType;
  /** True once an instrument has actually been read. */
  readonly instrumentInHand: boolean;
  /** True when a recorded easement was found, false when only inferred. */
  readonly easementConfirmed: boolean;
  /** True when an encumbered area is established rather than guessed. */
  readonly areaEstablished: boolean;
  /** True when an agency or utility has made contact about an acquisition. */
  readonly acquisitionPending: boolean;
  /** True where a screening range was produced at all. */
  readonly hasScreeningRange: boolean;
}

export interface RemedyPlan {
  readonly steps: readonly RemedyStep[];
  /** The single next thing to do. */
  readonly startHere: RemedyStep;
  /** Stated up front, because the sequence is the advice. */
  readonly sequencingNote: string;
  readonly urgencyNote: string | null;
}

const SEQUENCING_NOTE =
  'Work down this list in order and stop when your question is answered. The later steps cost ' +
  'real money and are worth taking only once the earlier ones have established that there is ' +
  'something worth arguing about. A great many easement questions are settled for nothing at step ' +
  'one, by reading the document that created it.';

const ACQUISITION_URGENCY =
  'AN ACQUISITION IS PENDING, WHICH CHANGES THE ORDER. Offers frequently carry deadlines, and ' +
  'some rights are harder to assert after acceptance than before. Speak to an attorney BEFORE ' +
  'signing or accepting anything, even if you have not finished the earlier steps. That is the ' +
  'one place in this plan where the cheap-first rule does not apply.';

/**
 * Builds the plan.
 *
 * The steps are conditional on what is already known, so a homeowner who has
 * their instrument in hand is not told to go and find it.
 */
export function buildRemedyPlan(inputs: RemedyPlanInputs): RemedyPlan {
  const steps: RemedyStep[] = [];
  let order = 1;
  const push = (s: Omit<RemedyStep, 'order'>) => steps.push({ order: order++, ...s });

  if (!inputs.easementConfirmed) {
    push({
      title: 'Confirm the easement actually exists, and is recorded',
      outcome:
        'A yes or no, from the county recorder rather than from a map layer. Infrastructure ' +
        'crossing your land does not by itself prove an easement was ever granted — and if none ' +
        'was, that is a materially different and much stronger position.',
      actor: 'you',
      cost: 'records-fee',
      whyNow:
        'Everything downstream depends on this. Paying an appraiser to value an easement nobody ' +
        'can produce a document for is the most expensive way to discover it may not exist.',
      weCanProvide: false,
    });
  }

  if (!inputs.instrumentInHand) {
    push({
      title: 'Get a copy of the easement instrument and read its terms',
      outcome:
        'The document controls. It says how wide the easement is, what the holder may do, whether ' +
        'it runs with the land or ends, and what you retained. Most "can I build here" questions ' +
        'are answered outright by this page of text.',
      actor: 'you',
      cost: 'records-fee',
      whyNow:
        'This is the cheapest step with the highest chance of ending the matter, and every later ' +
        'step is better informed for having it.',
      weCanProvide: false,
      skipIf: 'You already have the recorded instrument.',
    });
  }

  push({
    title: 'Write to the easement holder for clarification',
    outcome:
      'A written answer about what they claim, what they intend, and what they will permit. ' +
      'Written matters: it creates a record and often resolves a dispute that a phone call would ' +
      'leave ambiguous.',
    actor: 'this tool',
    cost: 'our-fee',
    whyNow:
      'Once you know what the document says, the useful next move is finding out whether the ' +
      'holder agrees. Frequently they do, and the matter ends here.',
    weCanProvide: true,
  });

  if (!inputs.areaEstablished) {
    push({
      title: 'Establish the encumbered area properly',
      outcome:
        'A measured area rather than an estimate. This drives everything numerical, and a guess ' +
        'here propagates into every figure downstream.',
      actor: 'you',
      cost: 'professional-fee',
      whyNow:
        'Worth doing before an appraisal, not after — an appraiser given a wrong area produces a ' +
        'wrong answer at full price.',
      weCanProvide: false,
      skipIf: 'The recorded instrument states the width and length, or the county publishes the area.',
    });
  }

  if (inputs.acquisitionPending) {
    push({
      title: 'Speak to an attorney before you sign anything',
      outcome:
        'Advice on the offer, the deadline, and what accepting it forecloses. Only an attorney ' +
        'can tell you what you are entitled to.',
      actor: 'attorney',
      cost: 'professional-fee',
      whyNow:
        'Out of sequence deliberately. An offer with a deadline does not wait for the cheap steps ' +
        'to finish, and some rights are harder to assert after acceptance.',
      weCanProvide: false,
    });
  }

  push({
    title: 'Get a before-and-after appraisal',
    outcome:
      'The only figure that carries weight in a negotiation or a court: your property valued at ' +
      'its highest and best use without the easement, then with it, and the difference. This is ' +
      'the number the screening range on this page is not.',
    actor: 'licensed appraiser',
    cost: 'professional-fee',
    whyNow:
      inputs.hasScreeningRange
        ? 'Take this step when the screening range is large enough that the appraisal fee is worth ' +
          'paying to find out the real figure. That comparison is the range\'s entire purpose.'
        : 'No screening range could be produced for your situation, so an appraiser is the only ' +
          'route to a figure of any kind.',
    weCanProvide: false,
  });

  push({
    title: 'Hand over the referral package',
    outcome:
      'The appraiser or attorney starts from assembled evidence — parcel record, geometry, the ' +
      'sources queried and the dates — rather than from scratch. Cheaper intake, and fewer things ' +
      'you have to explain twice.',
    actor: 'this tool',
    cost: 'our-fee',
    whyNow: 'Do this at the same time as engaging the professional, not before and not after.',
    weCanProvide: true,
  });

  return {
    steps,
    startHere: steps[0]!,
    sequencingNote: SEQUENCING_NOTE,
    urgencyNote: inputs.acquisitionPending ? ACQUISITION_URGENCY : null,
  };
}
