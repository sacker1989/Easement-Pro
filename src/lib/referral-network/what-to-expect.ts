/**
 * What a homeowner might get back from an appraiser or an attorney — at best,
 * and at worst.
 *
 * WHY THIS AND NOT A DIRECTORY. A vetted registry needs recruitment before it
 * helps anyone, covers only where someone said yes, and goes stale as licences
 * lapse. It also answers a question the homeowner can already answer: every
 * state publishes a licence register.
 *
 * The question they genuinely cannot answer is this one. Most people hire an
 * appraiser once in their life and have no referent for what a good one
 * produces. Two concrete pictures give them something to hold a quote against,
 * which is all they need to shop. A registry is worth building later, from
 * usage, once there is evidence about who people actually engage.
 *
 * DELIBERATELY SHORT. An earlier draft of this carried red flags, scripted
 * questions and a credential explainer. That is a checklist for someone already
 * deep in the problem; a homeowner who has just learned the word "easement"
 * needs to know roughly what they are buying, and nothing more yet.
 */

export interface Expectation {
  readonly kind: 'appraiser' | 'attorney';
  readonly heading: string;
  /** Plain sentence framing what this professional is for. */
  readonly whatTheyDo: string;
  readonly bestCase: readonly string[];
  readonly worstCase: readonly string[];
}

export const APPRAISER_EXPECTATION: Expectation = {
  kind: 'appraiser',
  heading: 'If you hire an appraiser',
  whatTheyDo:
    'An appraiser puts a defensible number on what the easement costs you. They are the only ' +
    'person who can, and it is the figure this report cannot produce.',
  bestCase: [
    'They value your property twice — once as if the easement were not there, once with it — and ' +
      'the difference is your figure. This is the method the controlling federal standard requires.',
    'A written report that shows the comparable sales behind the number and explains the reasoning.',
    'They address the rest of your lot, not just the strip. A small easement can affect the whole ' +
      'parcel, and that effect is often the larger loss.',
  ],
  worstCase: [
    'A short letter with one number and no workings.',
    'A percentage of your land value — "easements are worth about half" — applied to the easement ' +
      'area. That is the shortcut the controlling standard rejects, and it is the same arithmetic ' +
      'as the rough range on this page.',
    'A flat "going rate" per foot, which the same standard says cannot stand in for market value.',
  ],
};

export const ATTORNEY_EXPECTATION: Expectation = {
  kind: 'attorney',
  heading: 'If you hire an attorney',
  whatTheyDo:
    'An attorney tells you what the easement actually permits and what your position is. Those ' +
    'are legal questions, and this report does not answer them.',
  bestCase: [
    'They read your recorded easement document before advising. Most of these questions are ' +
      'answered by the document itself.',
    'A plain explanation of what the holder may do, what you kept, and whether it can ever end.',
    'Your realistic options with a cost against each — including doing nothing, which is often the ' +
      'right answer.',
  ],
  worstCase: [
    'General advice about easements with no reference to your document.',
    'A confident answer about your rights from someone who has not seen the paperwork.',
    'A push toward a dispute before a single letter has been sent.',
  ],
};

export const EXPECTATIONS: readonly Expectation[] = [APPRAISER_EXPECTATION, ATTORNEY_EXPECTATION];

/**
 * Stated wherever these appear.
 *
 * This product keeps no list and takes no fee, and both halves matter: the
 * first is why the guidance is generic, the second is why it can be trusted to
 * be. A referral fee would make this a sales channel wearing the costume of
 * advice — and compensation is the element free mode removed from the
 * legal-document-assistant definition.
 */
export const NO_LIST_NO_FEE =
  'This service keeps no list of appraisers or attorneys and takes no referral fee from anyone. ' +
  'Your state publishes a public register of licensed appraisers, and your state bar runs a lawyer ' +
  'referral service. Those are the places to look.';
